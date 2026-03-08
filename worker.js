import { verifyFirebaseIdToken } from "./firebase.js";
import { json, corsHeaders, ALLOWED_ORIGINS } from "./utils.js";

import { getFilteredChildCardbyUser } from "./api_childlist.js";
import { getLoginUserInformation } from "./api_user.js";

import { encryptAES, decryptAES } from "./aes256.js";
import { createSupabase } from "./supabase.js";

import { XMLParser, XMLBuilder } from "fast-xml-parser";

// ------------------------------
// decryptSafe（async版）
// ------------------------------
async function decryptSafe(value, key) {
  if (!value || typeof value !== "string") return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (!value.startsWith("U2FsdGVkX1")) return value;

  try {
    const r = await decryptAES(value, key);
    return typeof r === "string" ? r : "";
  } catch (_) {
    return "";
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const url = new URL(request.url);
    const { sbSelect, sbUpsert, sbUpdate, sbDelete } = createSupabase(env);

    // ============================================================
    // ★ GET /getKml?file=xxxAll.kml&ChildNo=03
    //    → 親KMLを読み込み、ChildNo以外の子Placemarkを削除し、
    //       親カード（All）は必ず残す
    // ============================================================
    if (url.pathname === "/getKml") {
      const file = url.searchParams.get("file");
      const ChildNo = url.searchParams.get("ChildNo");

      if (!file) return new Response("Missing file", { status: 400 });

      const object = await env.KML_BUCKET.get(`kml/${file}`);
      if (!object) return new Response("KML not found", { status: 404 });

      const text = await object.text();

      // 子カードKML（xxx-03.kml）はフィルタ不要
      if (!ChildNo) {
        return new Response(text, {
          headers: {
            "Content-Type": "application/vnd.google-earth.kml+xml",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }

      // XML パース
      const parser = new XMLParser({ ignoreAttributes: false });
      const xmlObj = parser.parse(text);

      // Folder 内の Placemark を再帰的にフィルタリングする関数
      function filterFolder(folder) {
        if (!folder) return;

        // Placemark がある場合
        if (folder.Placemark) {
          folder.Placemark = folder.Placemark.filter(pm => {
            const name = pm.name;

            // 親カード（019全体）は残す
            if (name.includes("全体")) return true;

            // 子カード（019-03 など）は ChildNo と一致するものだけ残す
            return name.endsWith(ChildNo);
          });
        }

        // Folder の中に Folder がある場合（019-03, 019-05 など）
        if (folder.Folder) {
          const subFolders = Array.isArray(folder.Folder)
            ? folder.Folder
            : [folder.Folder];

          subFolders.forEach(sf => filterFolder(sf));
        }
      }

      // Document 内の Folder をフィルタリング
      filterFolder(xmlObj.kml.Document.Folder);

      // XML に戻す
      const builder = new XMLBuilder({ ignoreAttributes: false });
      const filtered = builder.build(xmlObj);

      return new Response(filtered, {
        headers: {
          "Content-Type": "application/vnd.google-earth.kml+xml",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    // ============================================================
    // ★ POST body 読み込み
    // ============================================================
    const body = await request.json().catch(() => ({}));
    const func = body.funcName;

    // ============================================================
    // ★ Firebase API Key（認証不要）
    // ============================================================
    if (func === "getFirebaseConfig") {
      return json({ apiKey: env.FIREBASE_APIKEY }, 200, origin);
    }

    // ============================================================
    // ★ POST getKml（認証不要）
    // ============================================================
    if (func === "getKml") {
      const file = body.file;
      if (!file) return new Response("Missing file", { status: 400 });

      const object = await env.KML_BUCKET.get(`kml/${file}`);
      if (!object) return new Response("KML not found", { status: 404 });

      return new Response(object.body, {
        headers: {
          "Content-Type": "application/vnd.google-earth.kml+xml",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    // ============================================================
    // ★ ここから先は Origin チェック
    // ============================================================
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return json({ status: "forbidden" }, 403);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // ============================================================
    // ★ Firebase 認証必須
    // ============================================================
    const authHeader = request.headers.get("Authorization") || "";
    const tokenMatch = authHeader.match(/^Bearer (.+)$/);
    if (!tokenMatch) return json({ status: "unauthorized" }, 401, origin);

    const firebaseUser = await verifyFirebaseIdToken(tokenMatch[1]);
    const email = firebaseUser.email;

    try {

      // -------------------------
      // ログインユーザー情報
      // -------------------------
      if (func === "getLoginUserInformation") {
        return json(
          await getLoginUserInformation(email, sbSelect),
          200,
          origin
        );
      }

      // -------------------------
      // 子カード一覧（AssignmentList.js 用）
      // -------------------------
      if (func === "getFilteredChildCardbyUser") {
        return json(
          await getFilteredChildCardbyUser(email, sbSelect),
          200,
          origin
        );
      }

      // -------------------------
      // ChildMap.js 用 訪問履歴削除 ＋ VisitStatus 自動更新（暗号化 ng_flag 対応）
      // -------------------------
      if (func === "deleteVisitRecord") {
        const { VisitID } = body;   // ★ VisitID を受け取る

        try {
          // 1) 削除対象の visit_record を取得
          const rec = await sbSelect("visit_record", `row_id=eq.${VisitID}`);
          if (!rec || rec.length === 0) {
            return json({ status: "error", message: "Record not found" }, 400, origin);
          }

          const { card_no, child_no, housing_no } = rec[0];

          // 2) visit_record を削除
          await sbDelete("visit_record", { row_id: VisitID });

          // 3) 貸出日を取得
          const childRes = await sbSelect(
            "child_list",
            `card_no=eq.${card_no}&child_no=eq.${child_no}`
          );
          const checkoutDate = childRes?.[0]?.checkout_date || "1900-01-01";

          // 4) 削除後の訪問履歴を再取得
          const allRec = await sbSelect(
            "visit_record",
            `card_no=eq.${card_no}&child_no=eq.${child_no}&housing_no=eq.${housing_no}`
          );

          // 5) 貸出日以降の履歴だけに絞る
          const filtered = allRec.filter(r => r.visit_date >= checkoutDate);

          // 6) VisitStatus を決定
          let newStatus = "未訪問";

          const okWords = ["済", "済(投函)", "済(留守録)"];
          const hasOK = filtered.some(r =>
            okWords.some(w => (r.result || "").includes(w))
          );

          if (hasOK) newStatus = "済";
          else if (filtered.length > 0) newStatus = "不在";

          // 7) detail の ng_flag を復号して確認
          const detailRes = await sbSelect(
            "detail",
            `card_no=eq.${card_no}&child_no=eq.${child_no}&housing_no=eq.${housing_no}`
          );

          const detail = detailRes?.[0];
          let ngFlagPlain = "";

          if (detail?.ng_flag) {
            ngFlagPlain = await decryptSafe(detail.ng_flag, env.SUPABASE_AESKEY);
          }

          if (ngFlagPlain === "不可") {
            newStatus = "訪問不可";
          }

          // 8) detail.visit_status を UPDATE（暗号化）
          await sbUpdate(
            "detail",
            { row_id: detail.row_id },
            {
              visit_status: await encryptAES(newStatus, env.SUPABASE_AESKEY)
            }
          );

          return json(
            {
              status: "success",
              visitStatus: newStatus
            },
            200,
            origin
          );

        } catch (e) {
          return json(
            {
              status: "error",
              message: e.message
            },
            500,
            origin
          );
        }
      }

      // -------------------------
      // ChildMap.js 用 getChildDetail
      // -------------------------
      if (func === "getChildDetail") {
        const { CardNo, ChildNo } = body;

        const cardRes = await sbSelect(
          "card_list",
          `card_no=eq.${CardNo}`
        );

        const childRes = await sbSelect(
          "child_list",
          `card_no=eq.${CardNo}&child_no=eq.${ChildNo}`
        );

        const detailRes = await sbSelect(
          "detail",
          `card_no=eq.${CardNo}&child_no=eq.${ChildNo}`
        );

        const visitRes = await sbSelect(
          "visit_record",
          `card_no=eq.${CardNo}&child_no=eq.${ChildNo}`
        );

        const userMasterRes = await sbSelect("user_master", "");

        const c = cardRes?.[0] || {};
        const cardInfo = {
          CardID: c.id,
          CardNo: c.card_no,
          Type: c.type,
          Color: c.color,
          Childs: c.childs,
          Area: c.area,
          TownName: c.town_name,
          KML: c.kml,
          PDF: c.pdf,
          LNG: c.lng,
          LAT: c.lat,
          Term: c.term,
          Status: c.status,
          Group: c.group,
          Arrenger: c.arrenger,
          StartDate: c.start_date,
          LimitDate: c.limit_date,
          CheckoutDate: c.checkout_date,
          ReturnDate: c.return_date,
          NextavailableDate: c.next_available_date,
          Renew: c.renew,
          Description: c.description,
          Timestamp: c.timestamp,
          Operator: c.operator,
        };

        const ch = childRes?.[0] || {};
        const childInfo = {
          ChildID: ch.id,
          CardNo: ch.card_no,
          ChildNo: ch.child_no,
          ChildBlock: ch.block,
          ChildHouses: ch.houses,
          ChildPdf: ch.pdf,
          ChildKml: ch.kml,
          ChildLng: ch.lng,
          ChildLat: ch.lat,
          ChildTerm: ch.term,
          ChildStatus: ch.status,
          ChildGroup: ch.group,
          ChildArrenger: ch.arrenger,
          ChildMinister: ch.minister,
          ChildStartDate: ch.checkout_date,
          ChildLimitDate: ch.limit_date,
          ChildCheckoutDate: ch.checkout_date,
          ChildReturnDate: ch.return_date,
          ChildNextavailableDate: ch.next_available_date,
          ChildRenew: ch.renew,
          ChildOverdue: ch.overdue,
          ChildLost: ch.lost,
          ChildDescription: ch.description,
          ChildAttach1: ch.child_attach1,
          ChildAttach2: ch.child_attach2,
          ChildAttach3: ch.child_attach3,
          ChildTimestamp: ch.timestamp,
          ChildOperator: ch.operator,
          ChildParentStatus: ch.parent_status,
          BadFlag: ch.bad_flag,
          BadComment: ch.bad_comment,
          BadTimestamp: ch.bad_timestamp,
          BadOperator: ch.bad_operator,
          BadDetail: ch.bad_detail,
          Home: ch.home,
          Bussiness: ch.bussiness,
          Autolock: ch.autolock,
          TelEnabled: ch.tel_enabled,
          NgHouse: ch.ng_count,
          UncheckedNg: ch.unchecked_ng,
          Visited: ch.visited,
          YongerGen: ch.younger_gen,
          ChildClassify: ch.child_classify,
          Flag1: ch.flag1,
          Flag2: ch.flag2,
          NicknameFlag: ch.nickname_flag,
          Nickname: ch.nickname,
          UserMemo: ch.user_memo,
        };

        const houses = await Promise.all(
          (detailRes || []).map(async (h) => {
            const building_no       = await decryptSafe(h.building_no, env.SUPABASE_AESKEY);
            const building_category = await decryptSafe(h.building_category, env.SUPABASE_AESKEY);
            const building_name     = await decryptSafe(h.building_name, env.SUPABASE_AESKEY);
            const floors            = await decryptSafe(h.floors, env.SUPABASE_AESKEY);
            const rooms             = await decryptSafe(h.rooms, env.SUPABASE_AESKEY);
            const room_no           = await decryptSafe(h.room_no, env.SUPABASE_AESKEY);
            const family_name       = await decryptSafe(h.family_name, env.SUPABASE_AESKEY);
            const tel               = await decryptSafe(h.tel, env.SUPABASE_AESKEY);
            const tel_source        = await decryptSafe(h.tel_source, env.SUPABASE_AESKEY);
            const tel_updatedate    = await decryptSafe(h.tel_update_date, env.SUPABASE_AESKEY);
            const note              = await decryptSafe(h.note, env.SUPABASE_AESKEY);
            const comment           = await decryptSafe(h.comment, env.SUPABASE_AESKEY);
            const csv_townname      = await decryptSafe(h.csv_town_name, env.SUPABASE_AESKEY);
            const csv_cho           = await decryptSafe(h.csv_cho, env.SUPABASE_AESKEY);
            const csv_banchi        = await decryptSafe(h.csv_banchi, env.SUPABASE_AESKEY);
            const csv_url           = await decryptSafe(h.csv_url, env.SUPABASE_AESKEY);
            const csv_blankfield    = await decryptSafe(h.csv_blank_field, env.SUPABASE_AESKEY);
            const csv_lng           = await decryptSafe(h.csv_lng, env.SUPABASE_AESKEY);
            const csv_lat           = await decryptSafe(h.csv_lat, env.SUPABASE_AESKEY);
            const ng_flag           = await decryptSafe(h.ng_flag, env.SUPABASE_AESKEY);
            const ng_date           = await decryptSafe(h.ng_date, env.SUPABASE_AESKEY);
            const ng_comment        = await decryptSafe(h.ng_comment, env.SUPABASE_AESKEY);
            const ng_sarvant        = await decryptSafe(h.ng_sarvant, env.SUPABASE_AESKEY);
            const ng_checked        = await decryptSafe(h.ng_checked, env.SUPABASE_AESKEY);
            const visit_status      = await decryptSafe(h.visit_status, env.SUPABASE_AESKEY);
            const description       = await decryptSafe(h.description, env.SUPABASE_AESKEY);
            const timestamp         = await decryptSafe(h.timestamp, env.SUPABASE_AESKEY);
            const operator          = await decryptSafe(h.operator, env.SUPABASE_AESKEY);
            const bad_flag          = await decryptSafe(h.bad_flag, env.SUPABASE_AESKEY);
            const bad_comment       = await decryptSafe(h.bad_comment, env.SUPABASE_AESKEY);
            const bad_timestamp     = await decryptSafe(h.bad_timestamp, env.SUPABASE_AESKEY);
            const bad_operator      = await decryptSafe(h.bad_operator, env.SUPABASE_AESKEY);
            const input_townname    = await decryptSafe(h.input_town_name, env.SUPABASE_AESKEY);
            const input_cho         = await decryptSafe(h.input_cho, env.SUPABASE_AESKEY);
            const input_banchi      = await decryptSafe(h.input_banchi, env.SUPABASE_AESKEY);
            const address_sw        = await decryptSafe(h.address_sw, env.SUPABASE_AESKEY);
            const younger_gen_flag  = await decryptSafe(h.younger_gen_flag, env.SUPABASE_AESKEY);
            const yg_flag_timestamp = await decryptSafe(h.yg_flag_timestamp, env.SUPABASE_AESKEY);
            const yg_flag_operator  = await decryptSafe(h.yg_flag_operator, env.SUPABASE_AESKEY);

            const VRecord = await Promise.all(
              (visitRes || [])
                .filter(r => Number(r.housing_no) === Number(h.housing_no))
                .map(async (r) => ({
                  VisitID: r.row_id,
                  CardNo: r.card_no,
                  ChildNo: r.child_no,
                  HousingNo: r.housing_no,
                  VisitDate: r.visit_date,

                  Time:      await decryptSafe(r.time, env.SUPABASE_AESKEY),
                  Field:     await decryptSafe(r.field, env.SUPABASE_AESKEY),
                  Result:    await decryptSafe(r.result, env.SUPABASE_AESKEY),
                  Minister:  "",
                  Comment:   await decryptSafe(r.comment, env.SUPABASE_AESKEY),
                  Note:      await decryptSafe(r.note, env.SUPABASE_AESKEY),
                  Term:      await decryptSafe(r.term, env.SUPABASE_AESKEY),
                }))
            );

            return {
              DetailID: h.row_id,
              CardNo: h.card_no,
              ChildNo: h.child_no,
              HousingNo: h.housing_no,
              Type: h.type,

              BuildingNo:       building_no,
              BuildingCategory: building_category,
              BuildingName:     building_name,
              Floors:           floors,
              Rooms:            rooms,
              RoomNo:           room_no,
              FamilyName:       family_name,
              TEL:              tel,
              TELSource:        tel_source,
              TELUpdateDate:    tel_updatedate,
              Comment:          comment,
              Note:             note,
              CSVTownName:      csv_townname,
              CSVCho:           csv_cho,
              CSVBanchi:        csv_banchi,
              CSVURL:           csv_url,
              CSVBlankField:    csv_blankfield,
              CSVLng:           csv_lng ? Number(csv_lng) : null,
              CSVLat:           csv_lat ? Number(csv_lat) : null,
              NGFlag:           ng_flag,
              NGDate:           ng_date,
              NGComment:        ng_comment,
              NGSarvant:        ng_sarvant,
              NGChecked:        ng_checked,
              VisitStatus:      visit_status,
              Description:      description,
              TimeStamp:        timestamp,
              Operator:         operator,
              BadFlag:          bad_flag,
              BadComment:       bad_comment,
              BadTimeStamp:     bad_timestamp,
              BadOperator:      bad_operator,
              InputTownName:    input_townname,
              InputCho:         input_cho,
              InputBanchi:      input_banchi,
              AddressSW:        address_sw,
              Address:          address_sw,
              YoungerGENFlag:   younger_gen_flag,
              YGFlagTimeStamp:  yg_flag_timestamp,
              YGFlagOperator:   yg_flag_operator,

              VRecord,
            };
          })
        );

        houses.sort((a, b) => {
          if (a.CardNo !== b.CardNo) return a.CardNo - b.CardNo;
          if (a.ChildNo !== b.ChildNo) return a.ChildNo - b.ChildNo;
          return a.HousingNo - b.HousingNo;
        });

        return json(
          {
            status: "success",
            cardInfo,
            childInfo,
            houses
          },
          200,
          origin
        );
      }

      // -------------------------
      // 訪問履歴取得
      // -------------------------
      if (func === "getVisitRecord") {
        const { CardNo, ChildNo } = body;

        const visitRes = await sbSelect(
          "visit_record",
          `card_no=eq.${CardNo}&child_no=eq.${ChildNo}`
        );

        return json(
          {
            status: "success",
            records: visitRes || [],
          },
          200,
          origin
        );
      }

      // -------------------------
      // 訪問結果 INSERT
      // -------------------------
      if (func === "upsertVisitRecord") {
        try {
          const record = {
            VisitID: body.VisitID,
            CardNo: body.CardNo,
            ChildNo: body.ChildNo,
            HousingNo: body.HousingNo,
            VisitDate: body.VisitDate,

            Time:      await encryptAES(body.Time || "", env.SUPABASE_AESKEY),
            FieId:     await encryptAES(body.Field || "", env.SUPABASE_AESKEY),
            Result:    await encryptAES(body.Result || "", env.SUPABASE_AESKEY),
            Note:      await encryptAES(body.Note || "", env.SUPABASE_AESKEY),
            Minister:  await encryptAES(body.minister || "", env.SUPABASE_AESKEY),
            Comment:   await encryptAES(body.Comment || "", env.SUPABASE_AESKEY),
            Term:      await encryptAES(body.Term || "", env.SUPABASE_AESKEY),
          };

          const inserted = await sbUpsert("visit_record", record);

          const d = body.detailUpdate;
          if (d) {
            const updateObj = {
              NgFlag:       await encryptAES(d.NgFlag || "", env.SUPABASE_AESKEY),
              VisitStatus:  await encryptAES(d.VisitStatus || "", env.SUPABASE_AESKEY),
            };

            await sbUpdate("detail", { row_id: d.DetailID }, updateObj, env);
          }

          return json({ status: "success", inserted }, 200, origin);

        } catch (err) {
          return json(
            { status: "error", message: err.toString() },
            500,
            origin
          );
        }
      }

      // -------------------------
      // Google Maps URL
      // -------------------------
      if (func === "getGoogleMapsUrl") {
        const apiKey = env.GMAP_APIKEY;
        const endpoint = env.GMAP_ENDPOINT_URL;

        return json(
          {
            mapUrl: `${endpoint}?key=${apiKey}&libraries=geometry`,
          },
          200,
          origin
        );
      }

      return json({ status: "unknown_func" }, 400, origin);

    } catch (err) {
      const headers = new Headers(corsHeaders(origin));
      headers.set("Content-Type", "application/json");

      return new Response(
        JSON.stringify({
          status: "error",
          message: err?.message || err?.toString(),
          stack: err?.stack || null,
        }),
        { status: 500, headers }
      );
    }
  },
};