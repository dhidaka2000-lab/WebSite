// ChildMap.js（修正版・1/3）
// Google Maps のロード順序を完全修正
// Worker / Supabase との連携は元のまま維持

const ChildMapApp = {
  data() {
    return {
      loading: true,
      savingResult: false,

      map: null,
      markers: [],
      infoWindow: null,
      googleMapsLoaded: false,   // ★ ロード完了フラグ

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

      await this.fetchLoginUser();
      await this.fetchChildDetail();

      this.loading = false;
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

      const payload = { funcName: "getLoginUserInformation" };

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
        this.loginUserId = data.uid;
        this.loginUserName = data.userName;
      }
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
    },

    // -----------------------------
    // ★ Google Maps を確実に1回だけロード
    // -----------------------------
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
          this.googleMapsLoaded = true;   // ★ ロード完了
          resolve();
        };

        script.onerror = reject;

        document.head.appendChild(script);
      });
    },

    // -----------------------------
    // ★ Google Maps 初期化
    // -----------------------------
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

      // ★ script.onload を確実に待つ
      await this.loadGoogleMaps(mapUrl);

      // ★ ロード完了後に初期化
      this.initMap();
    },

    initMap() {
      if (!window.google || !google.maps) {
        console.error("Google Maps API がまだロードされていません");
        return;
      }

      const el = document.getElementById("mapContainer");
      if (!el) return;

      this.map = new google.maps.Map(el, {
        center: { lat: 34.75, lng: 135.6 },
        zoom: 14,
      });

      this.infoWindow = new google.maps.InfoWindow();
    },
    // -----------------------------
    // 地図アコーディオン
    // -----------------------------
    async toggleMap() {
      this.mapOpen = !this.mapOpen;

      if (this.mapOpen) {
        await this.ensureMapInitialized();
        this.addAllMarkers(null);
      }
    },

    // -----------------------------
    // マーカー描画
    // -----------------------------
    addAllMarkers(focusHousingNo) {
      if (!this.map) return;

      // 既存マーカー削除
      this.markers.forEach(m => m.map = null);
      this.markers = [];

      const bounds = new google.maps.LatLngBounds();
      let hasPoint = false;

      for (const h of this.houses || []) {
        if (!h.CSVLat || !h.CSVLng) continue;

        const pos = { lat: Number(h.CSVLat), lng: Number(h.CSVLng) };

        const marker = new google.maps.marker.AdvancedMarkerElement({
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
    // 住戸フォーカス
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
        <div style="font-size:15px; max-width:260px; padding:6px 7px;">
          <div style="font-weight:bold; font-size:17px;">
            ${house.FamilyName || "（表札名なし）"}${house.FamilyName ? "さん" : ""}
          </div>
          <div style="color:#555; font-size:14px;">${addr.line1}</div>
          ${addr.line2 ? `<div style="color:#555; font-size:14px;">${addr.line2}</div>` : ""}
          <div style="margin-top:6px;">
            <span style="padding:2px 8px; border-radius:999px; background:${statusColor}; color:white;">
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
          <button onclick="childMapApp.scrollToHouse(${house.HousingNo})"
            style="width:100%; padding:6px 0; background:#007bff; color:white; border:none; border-radius:6px;">
            ▶ この住戸カードへ移動
          </button>
          <div style="display:flex; gap:6px;">
            <a href="${gmapUrl}" target="_blank"
              style="flex:1; text-align:center; padding:6px 0; background:#28a745; color:white; border-radius:6px;">
              Google Maps
            </a>
            <a href="${amapUrl}" target="_blank"
              style="flex:1; text-align:center; padding:6px 0; background:#555; color:white; border-radius:6px;">
              Apple Maps
            </a>
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

        return (b.VisitID ?? 0) - (a.VisitID ?? 0);
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
    // 訪問結果モーダルを開く
    // -----------------------------
    openResultModal(house) {
      this.selectedHouse = house;

      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");

      this.resultForm.VisitDate = `${yyyy}-${mm}-${dd}`;
      this.resultForm.Time = "";
      this.resultForm.Field = "訪問";
      this.resultForm.Result = "不在";
      this.resultForm.Note = "";
      this.resultForm.NGFlag = "可";

      $("#resultModal").modal("show");
    },

    // -----------------------------
    // 訪問結果の保存
    // -----------------------------
    async saveResult() {
      if (!this.selectedHouse) return;

      this.savingResult = true;

      const user = firebase.auth().currentUser;
      const idToken = await user.getIdToken(true);

      const payload = {
        funcName: "upsertVisitRecord",
        CardNo: this.CardNo,
        ChildNo: this.ChildNo,
        HousingNo: this.selectedHouse.HousingNo,
        VisitDate: this.resultForm.VisitDate,
        Time: this.resultForm.Time,
        Field: this.resultForm.Field,
        Result: this.resultForm.Result,
        Note: this.resultForm.Note,
        NGFlag: this.resultForm.NGFlag,
        LoginUserID: this.loginUserId,
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
      this.savingResult = false;

      if (data.status !== "success") {
        console.error("保存エラー:", data);
        alert("保存に失敗しました");
        return;
      }

      $("#resultModal").modal("hide");

      await this.fetchChildDetail();
      this.$nextTick(() => {
        const el = document.getElementById(`house-${this.selectedHouse.HousingNo}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    },

    // -----------------------------
    // 訪問履歴削除
    // -----------------------------
    async deleteVisitRecord(VisitID) {
      if (!confirm("この訪問記録を削除しますか？")) return;

      const user = firebase.auth().currentUser;
      const idToken = await user.getIdToken(true);

      const payload = {
        funcName: "deleteVisitRecord",
        VisitID,
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
        alert("削除に失敗しました");
        return;
      }

      await this.fetchChildDetail();
    },

    // -----------------------------
    // 住所整形
    // -----------------------------
    getAddressLines(h) {
      const line1 = `${h.Prefecture || ""}${h.City || ""}${h.Town || ""}`;
      const line2 = h.Address || "";
      return { line1, line2 };
    },

    // -----------------------------
    // 最新在宅日
    // -----------------------------
    getLastMetDate(records) {
      if (!records || records.length === 0) return "";

      const met = records.filter(r => r.Result === "在宅");
      if (met.length === 0) return "";

      const sorted = met.sort((a, b) => b.VisitDate.localeCompare(a.VisitDate));
      return sorted[0].VisitDate;
    },

    // -----------------------------
    // ステータス色
    // -----------------------------
    getStatusColor(status) {
      switch (status) {
        case "在宅": return "#28a745";
        case "不在": return "#dc3545";
        case "要注意": return "#ffc107";
        default: return "#6c757d";
      }
    },

    // -----------------------------
    // 検索フィルタ
    // -----------------------------
    filteredHouses() {
      if (!this.searchQuery) return this.houses;

      const q = this.searchQuery.toLowerCase();
      return this.houses.filter(h =>
        (h.FamilyName || "").toLowerCase().includes(q) ||
        (h.Address || "").toLowerCase().includes(q)
      );
    },
  },
};

window.childMapApp = Vue.createApp(ChildMapApp).mount("#childMapApp");