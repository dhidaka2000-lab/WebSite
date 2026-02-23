// ChildMap.js（完全版）Part 1/2
// ・住所2行構成（cho-banchiはハイフン）
// ・user_masterからministerName取得
// ・InfoWindowフォント -3px ＋ 最新結果表示
// ・結果入力モーダル用の基礎ロジック（Part 2/2 で完結）

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

      cardNo: null,
      childNo: null,
      loginUser: null,

      cardInfo: {},
      childInfo: {},
      houses: [],
      userMaster: [],

      openVisitHistoryIds: new Set(),

      selectedHouse: null,
      resultForm: {
        visit_date: "",
        time: "",
        field: "訪問",
        result: "",
        note: "",
        ng_flag: "可"
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

    // 奉仕者名（user_master から取得）
    ministerName() {
      if (!this.childInfo?.Minister) return "-";
      const m = this.userMaster.find(
        u => String(u.ID) === String(this.childInfo.Minister)
      );
      return m ? m.UserName : "-";
    },

    // 時間帯の選択肢
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

    // 方法の選択肢
    methodOptions() {
      return [
        { value: "訪問", label: "訪問" },
        { value: "ｷｬﾝﾍﾟｰﾝ", label: "キャンペーン" },
        { value: "手紙", label: "手紙" },
        { value: "電話", label: "電話" },
        { value: "その他", label: "その他" },
      ];
    },

    // 方法に応じた結果の選択肢
    resultOptions() {
      const f = this.resultForm.field;
      if (f === "訪問") {
        return ["不在", "済"];
      } else if (f === "ｷｬﾝﾍﾟｰﾝ") {
        return ["不在", "済", "済(投函)", "済(留守録)", "その他"];
      } else if (f === "手紙") {
        return ["不在", "済(投函)"];
      } else if (f === "電話") {
        return ["不在", "済", "済(留守録)"];
      } else if (f === "その他") {
        return ["不在", "済", "済(投函)", "済(留守録)", "その他"];
      }
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
    // -----------------------------
    // URL パラメータ
    // -----------------------------
    parseQuery() {
      const params = new URLSearchParams(window.location.search);
      this.cardNo = params.get("cardNo");
      this.childNo = params.get("childNo");
      this.loginUser = params.get("loginUser");
    },

    // -----------------------------
    // 住所を 2 行に分割（cho と banchi の間はハイフン）
    // -----------------------------
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

    // 検索用（1行にまとめた住所）
    getDisplayAddress(house) {
      const a = this.getAddressLines(house);
      return a.line1 + (a.line2 ? " " + a.line2 : "");
    },

    // -----------------------------
    // 子カード詳細取得（user_master を含む）
    // -----------------------------
    async fetchChildDetail() {
      const user = firebase.auth().currentUser;
      const idToken = await user.getIdToken(true);

      const payload = {
        funcName: "getChildDetail",
        cardNo: this.cardNo,
        childNo: this.childNo,
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
      if (data.status === "success") {
        this.cardInfo = data.cardInfo;
        this.childInfo = data.childInfo;
        this.houses = data.houses;
        this.userMaster = data.userMaster || [];
      }
    },

    // -----------------------------
    // 地図アコーディオン
    // -----------------------------
    toggleMap() {
      this.mapOpen = !this.mapOpen;

      if (this.mapOpen) {
        this.$nextTick(async () => {
          await this.ensureMapInitialized();
        });
      }
    },

    // -----------------------------
    // Google Maps 読み込み
    // -----------------------------
    async loadGoogleMaps() {
      if (this.googleMapsLoaded && window.google?.maps) return;

      const user = firebase.auth().currentUser;
      const idToken = await user.getIdToken(true);

      const payload = { funcName: "getGoogleMapsUrl" };

      const urlRes = await fetch(this.apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + idToken,
        },
        body: JSON.stringify(payload),
      });

      const { mapUrl } = await urlRes.json();

      if (!mapUrl) throw new Error("Google Maps URL が取得できません");

      if (window.google?.maps) {
        this.googleMapsLoaded = true;
        return;
      }

      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = mapUrl;
        script.async = true;
        script.defer = true;

        script.onload = () => {
          this.googleMapsLoaded = true;
          resolve();
        };

        script.onerror = () => reject(new Error("Google Maps script failed"));

        document.head.appendChild(script);
      });
    },

    // -----------------------------
    // initMap
    // -----------------------------
    async ensureMapInitialized() {
      await this.loadGoogleMaps();

      if (this.map) {
        google.maps.event.trigger(this.map, "resize");
        return;
      }

      const first = this.houses[0];
      const center = first?.CSVLat
        ? { lat: Number(first.CSVLat), lng: Number(first.CSVLng) }
        : { lat: 34.6937, lng: 135.5023 };

      this.map = new google.maps.Map(
        document.getElementById("mapContainer"),
        {
          center,
          zoom: 16,
          mapTypeControl: false,
        }
      );

      this.infoWindow = new google.maps.InfoWindow();

      this.addAllMarkers(null);
      this.addCurrentLocationButton();
    },

    // -----------------------------
    // 現在地ボタン
    // -----------------------------
    addCurrentLocationButton() {
      const controlDiv = document.createElement("div");
      controlDiv.style.margin = "10px";

      const button = document.createElement("button");
      button.textContent = "現在地";
      button.style.background = "#fff";
      button.style.border = "2px solid #666";
      button.style.padding = "6px 10px";
      button.style.borderRadius = "4px";
      button.style.cursor = "pointer";
      button.style.fontSize = "17px";

      button.onclick = () => {
        navigator.geolocation.getCurrentPosition((pos) => {
          const loc = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };

          this.map.panTo(loc);
          this.map.setZoom(17);

          new google.maps.Marker({
            position: loc,
            map: this.map,
            icon: "http://maps.google.com/mapfiles/ms/icons/green-dot.png",
          });
        });
      };

      controlDiv.appendChild(button);
      this.map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(controlDiv);
    },

    // -----------------------------
    // 地図の高さ変更
    // -----------------------------
    setMapHeight(size) {
      const el = document.getElementById("mapContainer");
      if (!el) return;

      if (size === "small") el.style.height = "220px";
      if (size === "medium") el.style.height = "360px";
      if (size === "large") el.style.height = "520px";

      if (this.map) google.maps.event.trigger(this.map, "resize");
    },

    // -----------------------------
    // マーカー色
    // -----------------------------
    addAllMarkers(selectedId) {
      this.markers.forEach(m => m.setMap(null));
      this.markers = [];

      this.houses.forEach((h) => {
        if (!h.CSVLat || !h.CSVLng) return;

        let color = "#FFD700"; // 不在
        const status = (h.VisitStatus || "").trim();

        if (status.includes("済") || status.includes("在宅")) {
          color = "#00AA55"; // 緑
        }
        if (status.includes("NG")) {
          color = "#CC0000"; // 赤
        }

        const icon = {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10.5,
          fillColor: color,
          fillOpacity: 1,
          strokeWeight: 1,
          strokeColor: "#333"
        };

        const marker = new google.maps.Marker({
          position: { lat: Number(h.CSVLat), lng: Number(h.CSVLng) },
          map: this.map,
          icon,
          label: {
            text: String(h.ID),
            color: "#333",
            fontSize: "16px",
            fontWeight: "bold",
          },
        });

        marker.addListener("click", () => {
          this.focusOnMap(h);
        });

        this.markers.push(marker);
      });
    },

    // -----------------------------
    // 最後に会えた日付
    // -----------------------------
    getLastMetDate(records) {
      if (!records || records.length === 0) return null;

      const okWords = ["済", "在宅", "会えた"];

      const met = records.filter(r =>
        okWords.some(w => (r.Result || "").includes(w))
      );

      if (met.length === 0) return null;

      met.sort((a, b) => (b.VisitDate || "").localeCompare(a.VisitDate || ""));
      return met[0].VisitDate;
    },

    // 最新の訪問レコード（VisitDate 降順）
    getLatestRecord(records) {
      if (!records || records.length === 0) return null;
      const sorted = [...records].sort((a, b) =>
        (b.VisitDate || "").localeCompare(a.VisitDate || "")
      );
      return sorted[0];
    },

    // -----------------------------
    // InfoWindow（フォント -3px ＋ 最新結果表示）
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
      const latest = this.getLatestRecord(house.VRecord);

      const latestSummary = latest
        ? `${latest.Result || "-"}${latest.Time ? "（" + latest.Time + " / " : "（"}${latest.Field || "-"}）`
        : null;

      const gmapUrl = `https://www.google.com/maps?q=${pos.lat},${pos.lng}`;
      const amapUrl = `https://maps.apple.com/?ll=${pos.lat},${pos.lng}`;

      const html = `
        <div style="
          font-size:18px;
          max-width:260px;
          padding:12px 14px;
          border-radius:10px;
          box-shadow:0 2px 8px rgba(0,0,0,0.15);
          line-height:1.5;
        ">
          <div style="font-weight:bold; font-size:20px; margin-bottom:6px;">
            ${house.FamilyName || "（表札名なし）"}${house.FamilyName ? "さん" : ""}
          </div>

          <div style="color:#555; font-size:18px;">
            ${addr.line1}
          </div>
          ${
            addr.line2
              ? `<div style="color:#555; font-size:18px;">${addr.line2}</div>`
              : ""
          }

          <div style="font-size:16px; color:#777; margin-top:6px;">
            ステータス：${house.VisitStatus || "未訪問"}
          </div>

          ${
            lastMet
              ? `<div style="font-size:16px; color:#007bff; margin-top:6px;">
                   最後にお会いできた日：<strong>${lastMet}</strong>
                 </div>`
              : ""
          }

          ${
            latestSummary
              ? `<div style="font-size:16px; color:#28a745; margin-top:4px;">
                   最新の訪問結果：<strong>${latestSummary}</strong>
                 </div>`
              : ""
          }

          <hr style="margin:10px 0;">

          <button
            onclick="childMapApp.scrollToHouse(${house.HousingNo})"
            style="
              width:100%;
              padding:6px 0;
              background:#007bff;
              color:white;
              border:none;
              border-radius:6px;
              font-size:18px;
              cursor:pointer;
              margin-bottom:8px;
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
                font-size:16px;
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
                font-size:16px;
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
    scrollToHouse(id) {
      this.$nextTick(() => {
        const el = document.getElementById(`house-${id}`);
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
    sortedVRecord(records) {
      if (!records) return [];
      return [...records].sort((a, b) =>
        (b.VisitDate || "").localeCompare(a.VisitDate || "")
      );
    },

    isVisitHistoryOpen(id) {
      return this.openVisitHistoryIds.has(id);
    },

    toggleVisitHistory(id) {
      if (this.openVisitHistoryIds.has(id)) {
        this.openVisitHistoryIds.delete(id);
      } else {
        this.openVisitHistoryIds.add(id);
      }
      this.openVisitHistoryIds = new Set(this.openVisitHistoryIds);
    },

    // -----------------------------
    // モーダル初期値セット
    // -----------------------------
    openResultModal(house) {
      this.selectedHouse = house;

      // 今日の日付
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      this.resultForm.visit_date = `${yyyy}-${mm}-${dd}`;

      // 現在時刻 → 時間帯を自動判定
      const hour = today.getHours();
      if (hour < 9) this.resultForm.time = "9時以前";
      else if (hour < 12) this.resultForm.time = "9時〜12時";
      else if (hour < 13) this.resultForm.time = "12時〜13時";
      else if (hour < 16) this.resultForm.time = "13時〜16時";
      else if (hour < 18) this.resultForm.time = "16時〜18時";
      else this.resultForm.time = "18時以降";

      // 方法
      this.resultForm.field = "訪問";

      // 結果（初期値：不在）
      this.resultForm.result = "不在";

      // メモ
      this.resultForm.note = "";

      // 訪問可否（初期値：可）
      this.resultForm.ng_flag = "可";

      $("#resultModal").modal("show");
    },

    // -----------------------------
    // 方法変更 → 結果をクリア
    // -----------------------------
    onFieldChange() {
      this.resultForm.result = "";
    },

    // -----------------------------
    // visit_record INSERT + detail UPDATE
    // -----------------------------
    async submitResult() {
      if (!this.resultForm.visit_date) {
        alert("訪問日を入力してください。");
        return;
      }
      if (!this.resultForm.time) {
        alert("時間帯を選択してください。");
        return;
      }
      if (!this.resultForm.field) {
        alert("方法を選択してください。");
        return;
      }
      if (!this.resultForm.result) {
        alert("結果を選択してください。");
        return;
      }
      if (!this.resultForm.ng_flag) {
        alert("訪問可否を選択してください。");
        return;
      }

      this.savingResult = true;

      const user = firebase.auth().currentUser;
      const idToken = await user.getIdToken(true);

      // VisitStatus の自動決定
      let visitStatus = "その他";
      if (this.resultForm.result.includes("済")) visitStatus = "済";
      else if (this.resultForm.result.includes("不在")) visitStatus = "不在";
      else if (this.resultForm.result.includes("NG")) visitStatus = "NG";
      else if (this.resultForm.result.includes("保留")) visitStatus = "保留";

      // -----------------------------
      // Supabase に送る payload（snake_case）
      // -----------------------------
      const payload = {
        funcName: "upsertVisitRecord",

        // visit_record（平文）
        card_no: this.cardInfo.CardNo,
        child_no: this.childInfo.ChildNo,
        housing_no: this.selectedHouse.HousingNo,  // ★ 修正
        id: this.selectedHouse.HousingNo,          // ★ Worker が必要としている

        visit_date: this.resultForm.visit_date,

        // visit_record（暗号化対象）
        time: this.resultForm.time,
        field: this.resultForm.field,
        result: this.resultForm.result,
        note: this.resultForm.note,
        minister: this.ministerName,
        comment: "",
        term: this.childInfo.ChildTerm,

        // detail UPDATE（ng_flag + VisitStatus）
        detailUpdate: {   // ★ camelCase に統一
          row_id: this.selectedHouse.row_id,        // ★ 主キー
          ng_flag: this.resultForm.ng_flag,
          visit_status: visitStatus
        }
      };

      // -----------------------------
      // Worker 呼び出し
      // -----------------------------
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

      // 再取得して画面更新
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