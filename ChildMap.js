// ChildMap.js（完全版：UI刷新・アイコン・住所生成・InfoWindow地図リンク・訪問ステータス色分け・安定版）

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

      openVisitHistoryIds: new Set(),

      selectedHouse: null,
      resultForm: { result: "", comment: "" },

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
    // 住所生成（今回の仕様）
    // -----------------------------
    getDisplayAddress(house) {
      if (!house) return "";

      let base = "";

      if (house.AddressSW === "リストから選択") {
        base = `${house.CSVTownName || ""}${house.CSVCho || ""}${house.CSVBanchi || ""}`;
      } else if (house.AddressSW === "直接入力") {
        base = `${house.InputTownName || ""}${house.InputCho || ""}${house.InputBanchi || ""}`;
      }

      // 建物名・部屋番号
      if (house.BuildingName || house.RoomNo) {
        base += ` ${house.BuildingName || ""}${house.RoomNo ? house.RoomNo + "号室" : ""}`;
      }

      return base;
    },

    // -----------------------------
    // 子カード詳細取得
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
    // Google Maps 読み込み（完全保証）
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
    // initMap（安定版）
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
    // マーカー色（訪問ステータス）
    // -----------------------------
    addAllMarkers(selectedId) {
      this.markers.forEach(m => m.setMap(null));
      this.markers = [];

      this.houses.forEach((h) => {
        if (!h.CSVLat || !h.CSVLng) return;

        let color = "#FFD700"; // 不在（黄）

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
            fontSize: "13px",
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

    // -----------------------------
    // InfoWindow（地図アプリリンク付き）
    // -----------------------------
    async focusOnMap(house) {
      this.focusedId = house.ID;

      await this.ensureMapInitialized();
      this.addAllMarkers(house.ID);

      const pos = {
        lat: Number(house.CSVLat),
        lng: Number(house.CSVLng),
      };

      this.map.panTo(pos);
      this.map.setZoom(17);

      const addr = this.getDisplayAddress(house);
      const lastMet = this.getLastMetDate(house.VRecord);

      const gmapUrl = `https://www.google.com/maps?q=${pos.lat},${pos.lng}`;
      const amapUrl = `https://maps.apple.com/?ll=${pos.lat},${pos.lng}`;

      const html = `
        <div style="
          font-size:15px;
          max-width:240px;
          padding:10px 12px;
          border-radius:10px;
          box-shadow:0 2px 8px rgba(0,0,0,0.15);
          line-height:1.5;
        ">
          <div style="font-weight:bold; font-size:17px; margin-bottom:4px;">
            ${house.FamilyName || "（表札名なし）"}${house.FamilyName ? "さん" : ""}
          </div>

          <div style="color:#555; margin-bottom:4px; font-size:15px;">
            ${addr}
          </div>

          <div style="font-size:13px; color:#777;">
            ステータス：${house.VisitStatus || "未訪問"}
          </div>

          ${
            lastMet
              ? `<div style="font-size:13px; color:#007bff; margin-top:4px;">
                   最後にお会いできた日：<strong>${lastMet}</strong>
                 </div>`
              : ""
          }

          <hr style="margin:8px 0;">

          <button
            onclick="childMapApp.scrollToHouse(${house.ID})"
            style="
              width:100%;
              padding:6px 0;
              background:#007bff;
              color:white;
              border:none;
              border-radius:6px;
              font-size:15px;
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
    // 結果入力モーダル
    // -----------------------------
    openResultModal(house) {
      this.selectedHouse = house;
      this.resultForm.result = "";
      this.resultForm.comment = "";
      $("#resultModal").modal("show");
    },

    async submitResult() {
      this.savingResult = true;

      const user = firebase.auth().currentUser;
      const idToken = await user.getIdToken(true);

      const payload = {
        funcName: "upsertVisitRecord",
        cardNo: this.cardNo,
        childNo: this.childNo,
        houseId: this.selectedHouse.ID,
        result: this.resultForm.result,
        comment: this.resultForm.comment,
      };

      await fetch(this.apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + idToken,
        },
        body: JSON.stringify(payload),
      });

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