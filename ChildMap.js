// ChildMap.js（完全版・1/2）
// ★ 訪問履歴削除 row_id 対応済み
// ★ VRecord に RowID を追加済み（Worker 側と整合）

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

    ministerName() {
      if (!this.childInfo?.ChildMinister) return "-";
      const u = this.userMaster.find(
        x => String(x.ID) === String(this.childInfo.ChildMinister)
      );
      return u ? u.UserName : "-";
    },

    arrengerName() {
      if (!this.childInfo?.ChildArrenger) return "-";
      const u = this.userMaster.find(
        x => String(x.ID) === String(this.childInfo.ChildArrenger)
      );
      return u ? u.UserName : "-";
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
      const f = this.resultForm.field;
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
    // ★ 訪問履歴の削除（row_id 対応）
    // -----------------------------
    async deleteVisitRecord(rec) {
      if (!confirm("訪問履歴を削除してもよろしいですか？")) return;

      const user = firebase.auth().currentUser;
      const idToken = await user.getIdToken(true);

      const payload = {
        funcName: "deleteVisitRecord",
        row_id: rec.RowID   // ← ここが重要（id ではなく row_id）
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

      const okWords = ["済", "在宅", "会えた"];

      const met = records.filter(r =>
        okWords.some(w => (r.Result || "").includes(w))
      );

      if (met.length === 0) return null;

      met.sort((a, b) => (b.VisitDate || "").localeCompare(a.VisitDate || ""));
      return met[0].VisitDate;
    },

    // -----------------------------
    // ステータス色（住戸カードと整合）
    // -----------------------------
    getStatusColor(status) {
      if (!status) return "#999999";
      if (status.includes("済") || status.includes("在宅")) return "#00AA55";
      if (status.includes("NG")) return "#CC0000";
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

      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      this.resultForm.visit_date = `${yyyy}-${mm}-${dd}`;

      const hour = today.getHours();
      if (hour < 9) this.resultForm.time = "9時以前";
      else if (hour < 12) this.resultForm.time = "9時〜12時";
      else if (hour < 13) this.resultForm.time = "12時〜13時";
      else if (hour < 16) this.resultForm.time = "13時〜16時";
      else if (hour < 18) this.resultForm.time = "16時〜18時";
      else this.resultForm.time = "18時以降";

      this.resultForm.field = "訪問";
      this.resultForm.result = "不在";
      this.resultForm.note = "";
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

      let visitStatus = "その他";
      if (this.resultForm.result.includes("済")) visitStatus = "済";
      else if (this.resultForm.result.includes("不在")) visitStatus = "不在";
      else if (this.resultForm.result.includes("NG")) visitStatus = "NG";
      else if (this.resultForm.result.includes("保留")) visitStatus = "保留";

      const payload = {
        funcName: "upsertVisitRecord",

        card_no: this.cardInfo.CardNo,
        child_no: this.childInfo.ChildNo,
        housing_no: this.selectedHouse.HousingNo,
        id: this.selectedHouse.HousingNo,

        visit_date: this.resultForm.visit_date,

        time: this.resultForm.time,
        field: this.resultForm.field,
        result: this.resultForm.result,
        note: this.resultForm.note,
        minister: this.ministerName,
        comment: "",
        term: this.childInfo.ChildTerm,

        detailUpdate: {
          row_id: this.selectedHouse.row_id,
          ng_flag: this.resultForm.ng_flag,
          visit_status: visitStatus
        }
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