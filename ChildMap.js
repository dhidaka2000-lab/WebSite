// ChildMap.js（完全版・1/3）

const ChildMapApp = {
  data() {
    return {
      loading: true,
      savingResult: false,

      map: null,
      markers: [],
      infoWindow: null,
      googleMapsLoaded: false,

      mapOpen: false,
      focusedId: null,

      CardNo: null,
      ChildNo: null,
      loginUser: null,

      cardInfo: {},
      childInfo: {},
      houses: [],

      openVisitHistoryIds: new Set(),
      visitHistoryOpen: false,
      openVisitHistoryHouseId: null,

      selectedHouse: null,
      resultForm: {
        VisitDate: "",
        Time: "",
        Field: "訪問",
        Result: "",
        Note: "",
        NGFlag: "可"
      },

      searchQuery: "",
      apiEndpoint: "https://ekuikidev.dhidaka2000.workers.dev",
    };
  },

  computed: {
    filteredHouses() {
      if (!this.searchQuery) return this.houses;
      const q = this.searchQuery.toLowerCase();
      return this.houses.filter((h) =>
        (h.FamilyName || "").toLowerCase().includes(q) ||
        (h.BuildingName || "").toLowerCase().includes(q) ||
        this.getDisplayAddress(h).toLowerCase().includes(q)
      );
    },

    timeOptions() {
      return [
        "9時以前",
        "9時〜12時",
        "12時〜13時",
        "13時〜16時",
        "16時〜18時",
        "18時以降",
      ];
    },

    methodOptions() {
      return [
        { value: "訪問", label: "訪問" },
        { value: "ｷｬﾝﾍﾟｰﾝ", label: "キャンペーン" },
        { value: "手紙", label: "手紙" },
        { value: "電話", label: "電話" },
        { value: "その他", label: "その他" },
      ];
    },

    resultOptions() {
      const f = this.resultForm.Field;
      if (f === "訪問") return ["不在", "済"];
      if (f === "ｷｬﾝﾍﾟｰﾝ") return ["不在", "済", "済(投函)", "済(留守録)", "その他"];
      if (f === "手紙") return ["不在", "済(投函)"];
      if (f === "電話") return ["不在", "済", "済(留守録)"];
      if (f === "その他") return ["不在", "済", "済(投函)", "済(留守録)", "その他"];
      return [];
    },
  },

  mounted() {
    this.parseQuery();

    firebase.auth().onAuthStateChanged(async (user) => {
      if (!user) {
        alert("ログイン情報が失われました。ログインし直してください。");
        window.location.href = "./index.html";
        return;
      }
      await this.fetchChildDetail();
      this.loading = false;
    });
  },

  methods: {
    parseQuery() {
      const params = new URLSearchParams(window.location.search);
      this.cardNo = params.get("cardNo");
      this.childNo = params.get("childNo");
      this.loginUser = params.get("loginUser");
    },

    getAddressLines(house) {
      if (!house) return { line1: "", line2: "" };

      let line1 = "";
      let line2 = "";

      if (house.AddressSW === "リストから選択") {
        const cho = house.CSVCho || "";
        const banchi = house.CSVBanchi || "";
        const hyphen = cho && banchi ? "-" : "";
        line1 = `${house.CSVTownName || ""}${cho}${hyphen}${banchi}`;
      } else if (house.AddressSW === "直接入力") {
        const cho = house.InputCho || "";
        const banchi = house.InputBanchi || "";
        const hyphen = cho && banchi ? "-" : "";
        line1 = `${house.InputTownName || ""}${cho}${hyphen}${banchi}`;
      }

      if (house.BuildingName || house.RoomNo) {
        line2 = `${house.BuildingName || ""}${house.RoomNo ? house.RoomNo + "号室" : ""}`;
      }

      return { line1, line2 };
    },

    getDisplayAddress(house) {
      const a = this.getAddressLines(house);
      return a.line1 + (a.line2 ? " " + a.line2 : "");
    },

    async fetchChildDetail() {
      const user = firebase.auth().currentUser;
      const idToken = await user.getIdToken(true);

      const payload = {
        funcName: "getChildDetail",
        CardNo: this.cardNo,
        ChildNo: this.childNo
      };

      const res = await fetch(this.apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + idToken,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.status !== "success") {
        alert("データ取得に失敗しました");
        return;
      }

      this.cardInfo = data.cardInfo;
      this.childInfo = data.childInfo;
      this.houses = data.houses;

      if (this.map) {
        this.addAllMarkers(null);
      }
    },

    // -----------------------------
    // 訪問履歴削除（row_id 使用）
    // -----------------------------
    async deleteVisitRecord(rec) {
      if (!confirm("訪問履歴を削除してもよろしいですか？")) return;

      const user = firebase.auth().currentUser;
      const idToken = await user.getIdToken(true);

      const payload = {
        funcName: "deleteVisitRecord",
        VisitID: rec.VisitID
      };

      const res = await fetch(this.apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + idToken,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.status !== "success") {
        alert("削除中にエラーが発生しました。");
        return;
      }

      await this.fetchChildDetail();
    },

    // -----------------------------
    // 最後に会えた日付（在宅系）
    // -----------------------------
    getLastMetDate(records) {
      if (!records || records.length === 0) return null;

      const okWords = ["済", "済(投函)", "済(留守録)"];

      const met = records.filter(r =>
        okWords.some(w => (r.result || "").includes(w))
      );

      if (met.length === 0) return null;

      met.sort((a, b) => (b.visit_date || "").localeCompare(a.visit_date || ""));
      return met[0].visit_date;
    },

    // -----------------------------
    // ステータス色
    // -----------------------------
    getStatusColor(status) {
      if (!status) return "#999999";
      if (status.includes("済")) return "#00AA55";
      if (status.includes("訪問不可")) return "#CC0000";
      if (status.includes("不在")) return "#FFD700";
      return "#999999";
    },

    // -----------------------------
    // InfoWindow（レイアウト調整版）
    // -----------------------------
    async focusOnMap(house) {
      this.focusedId = house.HousingNo;

      await this.ensureMapInitialized();
      this.addAllMarkers(house.HousingNo);

      const pos = {
        lat: Number(house.CSVLat),
        lng: Number(house.CSVLng),
      };

      this.map.panTo(pos);
      this.map.setZoom(17);

      const addr = this.getAddressLines(house);
      const lastMet = this.getLastMetDate(house.VRecord);
      const statusColor = this.getStatusColor(house.VisitStatus || "");

      const gmapUrl = `https://www.google.com/maps?q=${pos.lat},${pos.lng}`;
      const amapUrl = `https://maps.apple.com/?ll=${pos.lat},${pos.lng}`;

      const html = `
        <div style="
          font-size:15px;
          max-width:260px;
          padding:6px 7px;
          border-radius:10px;
          box-shadow:0 2px 8px rgba(0,0,0,0.15);
          line-height:1.4;
        ">
          <div style="font-weight:bold; font-size:17px; margin-bottom:4px;">
            ${house.FamilyName || "（表札名なし）"}${house.FamilyName ? "さん" : ""}
          </div>

          <div style="color:#555; font-size:14px;">
            ${addr.line1}
          </div>
          ${
            addr.line2
              ? `<div style="color:#555; font-size:14px;">${addr.line2}</div>`
              : ""
          }

          <div style="margin-top:6px;">
            <span
              style="
                display:inline-block;
                padding:2px 8px;
                border-radius:999px;
                font-size:12px;
                font-weight:bold;
                background:${statusColor};
                color:${(house.VisitStatus || "").includes("不在") ? "#333" : "#fff"};
              "
            >
              ${house.VisitStatus || "未訪問"}
            </span>
          </div>

          ${
            lastMet
              ? `<div style="font-size:13px; color:#007bff; margin-top:6px;">
                  <strong>最新在宅日：</strong>${lastMet}
                </div>`
              : ""
          }

          <hr style="margin:8px 0;">

          <button
            onclick="childMapApp.scrollToHouse(${house.HousingNo})"
            style="
              width:100%;
              padding:6px 0;
              background:#007bff;
              color:white;
              border:none;
              border-radius:6px;
              font-size:14px;
              cursor:pointer;
              margin-bottom:6px;
            "
          >
            ▶ この住戸カードへ移動
          </button>

          <div style="display:flex; gap:6px;">
            <a href="${gmapUrl}" target="_blank"
              style="
                flex:1;
                text-align:center;
                padding:6px 0;
                background:#28a745;
                color:white;
                border-radius:6px;
                font-size:13px;
                text-decoration:none;
              "
            >Google Maps</a>

            <a href="${amapUrl}" target="_blank"
              style="
                flex:1;
                text-align:center;
                padding:6px 0;
                background:#555;
                color:white;
                border-radius:6px;
                font-size:13px;
                text-decoration:none;
              "
            >Apple Maps</a>
          </div>
        </div>
      `;

      this.infoWindow.setContent(html);
      this.infoWindow.setPosition(pos);
      this.infoWindow.open(this.map);
    },

    // -----------------------------
    // 訪問履歴ソート（snake_case 対応）
    // -----------------------------
    sortedVRecord(records) {
      if (!records) return [];

      const timeOrder = {
        "9時以前": 1,
        "9時〜12時": 2,
        "12時〜13時": 3,
        "13時〜16時": 4,
        "16時〜18時": 5,
        "18時以降": 6
      };

      return [...records].sort((a, b) => {
        if (a.visit_date !== b.visit_date) {
          return b.visit_date.localeCompare(a.visit_date);
        }

        const ta = timeOrder[a.time] || 0;
        const tb = timeOrder[b.time] || 0;
        if (ta !== tb) return tb - ta;

        return (b.row_id ?? 0) - (a.row_id ?? 0);
      });
    },

    // -----------------------------
    // ID ボタン → 地図へスクロール → ピン表示
    // -----------------------------
    scrollToMapAndFocus(house) {
      if (!this.mapOpen) this.mapOpen = true;

      this.$nextTick(() => {
        const mapEl = document.getElementById("mapContainer");
        mapEl.scrollIntoView({ behavior: "smooth", block: "start" });

        setTimeout(() => {
          this.focusOnMap(house);
        }, 400);
      });
    },

    // -----------------------------
    // カードへスクロール
    // -----------------------------
    scrollToHouse(ID) {
      this.$nextTick(() => {
        const el = document.getElementById(`house-${ID}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("focused-house");
          setTimeout(() => el.classList.remove("focused-house"), 1500);
        }
      });
    },

    // -----------------------------
    // 訪問履歴アコーディオン
    // -----------------------------
    toggleVisitHistory(HousingNo) {
      if (this.openVisitHistoryIds.has(HousingNo)) {
        this.openVisitHistoryIds.delete(HousingNo);
      } else {
        this.openVisitHistoryIds.add(HousingNo);
      }
      this.openVisitHistoryIds = new Set(this.openVisitHistoryIds);
    },

    isVisitHistoryOpen(housingNo) {
      return this.openVisitHistoryIds.has(housingNo);
    },

    // -----------------------------
    // モーダル初期値セット
    // -----------------------------
    openResultModal(house) {
      this.selectedHouse = house;

      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");

      const VisitDate = `${yyyy}-${mm}-${dd}`;
      const hour = today.getHours();
      const Time = this.timeOptions[
        hour < 9 ? 0 : hour < 12 ? 1 : hour < 13 ? 2 : hour < 16 ? 3 : hour < 18 ? 4 : 5
      ];

      this.resultForm = {
        VisitDate,
        Time,
        Field: this.methodOptions[0].value,
        Result: "不在",
        Note: "",
        NGFlag: "可"
      };

      this.$nextTick(() => {
        setTimeout(() => {
          $("#resultModal").modal("show");
        }, 200);
      });
    },

    onFieldChange() {
      this.resultForm.Result = "";
    },

    // -----------------------------
    // visit_record INSERT
    // -----------------------------
    async submitResult() {
      if (!this.resultForm.VisitDate ||
          !this.resultForm.Time ||
          !this.resultForm.Field ||
          !this.resultForm.Result ||
          !this.resultForm.NGFlag) {
        alert("入力内容を確認してください。");
        return;
      }

      this.savingResult = true;

      const user = firebase.auth().currentUser;
      const idToken = await user.getIdToken(true);

      const payload = {
        funcName: "upsertVisitRecord",

        CardNo: this.cardInfo.CardNo,
        ChildNo: this.childInfo.ChildNo,
        HousingNo: this.selectedHouse.HousingNo,

        VisitDate: this.resultForm.VisitDate,
        Time: this.resultForm.Time,
        Field: this.resultForm.Field,
        Result: this.resultForm.Result,
        Note: this.resultForm.Note,

        // ★ minister は UI から完全排除 → null を送る
        Minister: null,

        Comment: "",
        Term: this.childInfo.ChildTerm
      };

      const res = await fetch(this.apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + idToken,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.status !== "success") {
        console.error("保存エラー:", data);
        alert("保存中にエラーが発生しました。");
        this.savingResult = false;
        return;
      }

      $("#resultModal").modal("hide");
      this.savingResult = false;

      await this.fetchChildDetail();
      if (this.map) {
        this.addAllMarkers(null);
      }
    },

    // -----------------------------
    // ページ遷移
    // -----------------------------
    goBackToMyPage() {
      window.location.href = "./AssignmentList.html";
    },

    goHome() {
      window.location.href = "./mainMenu.html";
    },

    async logout() {
      try {
        await firebase.auth().signOut();
      } catch (e) {
        console.error(e);
      }
      window.location.href = "./index.html";
    },
  },
};

window.childMapApp = Vue.createApp(ChildMapApp).mount("#childMapApp");