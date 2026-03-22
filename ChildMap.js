// ChildMap.js（完全版・1/3）
// ChildMap.js（修正版）

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
      loginUserId: null,
      loginUserName: "",

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
        Result: "不在",
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

    // ヘッダー表示用
    ministerName() {
      return this.childInfo?.ChildMinister || this.loginUserName || "-";
    },
    arrengerName() {
      return this.childInfo?.ChildArrenger || "-";
    },
  },

  async mounted() {
    this.mapOpen = false;
    this.parseQuery();

    // モーダルを Vue 管理下に固定
    $('#resultModal').appendTo('#childMapApp');

    firebase.auth().onAuthStateChanged(async (user) => {
      if (!user) {
        alert("ログイン情報が失われました。ログインし直してください。");
        window.location.href = "./index.html";
        return;
      }

      // ① ログインユーザー情報（ID＋名前）取得
      await this.fetchLoginUser();
      // ② 子カード詳細取得
      await this.fetchChildDetail();

      this.mapOpen = false; // 初期は閉じた状態
      this.loading = false;

      await this.ensureMapInitialized();  // ★ Map初期ロード
    });
  },

  methods: {
    parseQuery() {
      const params = new URLSearchParams(window.location.search);
      this.CardNo = params.get("cardNo");
      this.ChildNo = params.get("childNo");
      this.loginUser = params.get("loginUser");
    },

    async fetchLoginUser() {
      const user = firebase.auth().currentUser;
      const idToken = await user.getIdToken(true);

      const payload = {
        funcName: "getLoginUserInformation"
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
        this.loginUserId = data.uid;        // visit_record.minister に保存する値
        this.loginUserName = data.userName; // 画面表示用
      }
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
        CardNo: this.CardNo,
        ChildNo: this.ChildNo
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
    // 地図アコーディオン
    // -----------------------------
    async toggleMap() {
      this.mapOpen = !this.mapOpen;

      if (this.mapOpen) {
        await this.ensureMapInitialized();  // ★ Google Maps 読み込み完了まで待つ
        this.addAllMarkers(null);           // ★ 初期マーカー描画
      }
    },


    setMapHeight(size) {
      const el = document.getElementById("mapContainer");
      if (!el) return;
      if (size === "small") el.style.height = "260px";
      else if (size === "large") el.style.height = "520px";
      else el.style.height = "360px";

      if (this.map) {
        google.maps.event.trigger(this.map, "resize");
      }
    },

    async ensureMapInitialized() {
      if (this.googleMapsLoaded && this.map) return;

      const user = firebase.auth().currentUser;
      const idToken = await user.getIdToken(true);

      const payload = { funcName: "getGoogleMapsUrl" };

      const res = await fetch(this.apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + idToken,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      const mapUrl = data.mapUrl;

      await this.loadGoogleMaps(mapUrl);
      this.initMap();
    },

    loadGoogleMaps(src) {
      return new Promise((resolve, reject) => {
        if (this.googleMapsLoaded) {
          resolve();
          return;
        }
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.defer = true;
        script.onload = () => {
          this.googleMapsLoaded = true;
          resolve();
        };
        script.onerror = reject;
        document.head.appendChild(script);
      });
    },

    initMap() {
      const el = document.getElementById("mapContainer");
      if (!el) return;

      const center = { lat: 34.75, lng: 135.6 }; // 適当な初期値（大阪近辺）

      this.map = new google.maps.Map(el, {
        center,
        zoom: 14,
      });

      this.infoWindow = new google.maps.InfoWindow();
    },

    addAllMarkers(focusHousingNo) {
      if (!this.map) return;

      // 既存マーカー削除
      this.markers.forEach(m => m.setMap(null));
      this.markers = [];

      const bounds = new google.maps.LatLngBounds();
      let hasPoint = false;

      for (const h of this.houses || []) {
        if (!h.CSVLat || !h.CSVLng) continue;

        const pos = { lat: Number(h.CSVLat), lng: Number(h.CSVLng) };
        const marker = new google.maps.Marker({
          position: pos,
          map: this.map,
          title: (h.FamilyName || "") + (h.FamilyName ? "さん" : ""),
        });

        marker.addListener("click", () => {
          this.focusOnMap(h);
        });

        this.markers.push(marker);
        bounds.extend(pos);
        hasPoint = true;
      }

      if (hasPoint) {
        this.map.fitBounds(bounds);
      }

      if (focusHousingNo) {
        const target = (this.houses || []).find(h => h.HousingNo === focusHousingNo);
        if (target && target.CSVLat && target.CSVLng) {
          const pos = { lat: Number(target.CSVLat), lng: Number(target.CSVLng) };
          this.map.setCenter(pos);
          this.map.setZoom(17);
        }
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
        okWords.some(w => (r.Result || "").includes(w))
      );

      if (met.length === 0) return null;

      met.sort((a, b) => (b.VisitDate || "").localeCompare(a.VisitDate || ""));
      return met[0].VisitDate;
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
    // 訪問履歴ソート
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
        if (a.VisitDate !== b.VisitDate) {
          return b.VisitDate.localeCompare(a.VisitDate);
        }

        const ta = timeOrder[a.Time] || 0;
        const tb = timeOrder[b.Time] || 0;
        if (ta !== tb) return tb - ta;

        return (b.VisitID  ?? 0) - (a.VisitID  ?? 0);
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

    isVisitHistoryOpen(HousingNo) {
      return this.openVisitHistoryIds.has(HousingNo);
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
        NGFlag: house.NGFlag || "可",
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
    // visit_record INSERT / UPDATE
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
        NGFlag: this.resultForm.NGFlag,
        Minister: this.loginUserId,      // ★ ID を保存
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

      // Worker が note を加工して保存するので、フロント側でも即時反映
      let finalNote = this.resultForm.Note || "";
      if (this.resultForm.NGFlag === "不可") {
        finalNote = `訪問不可が入力された。${finalNote}`;
      }

      // 住戸の VisitStatus も Worker と同じロジックで更新
      let newStatus = "未訪問";
      if (this.resultForm.NGFlag === "不可") {
        newStatus = "訪問不可";
      } else if (this.resultForm.Result.includes("済")) {
        newStatus = "済";
      } else if (this.resultForm.Result.includes("不在")) {
        newStatus = "不在";
      }

      this.selectedHouse.NGFlag = this.resultForm.NGFlag;
      this.selectedHouse.VisitStatus = newStatus;

      // VRecord に新しい履歴を push（即時反映）
      this.selectedHouse.VRecord.push({
        VisitID: data.inserted?.row_id ?? null,
        VisitDate: this.resultForm.VisitDate,
        Time: this.resultForm.Time,
        Field: this.resultForm.Field,
        Result: this.resultForm.Result,
        Minister: this.loginUserName,  // 表示用は名前
        Note: finalNote
      });
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