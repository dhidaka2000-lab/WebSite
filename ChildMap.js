// ChildMap.js（IDボタン連動＋全件黄色●＋選択だけ赤ピン＋IDラベル＋InfoWindowリンク＋現在地ボタン復活）

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
        (h.Address || "").toLowerCase().includes(q) ||
        (h.FamilyName || "").toLowerCase().includes(q) ||
        (h.BuildingName || "").toLowerCase().includes(q)
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
          if (!this.map) {
            await this.initMap();
          } else {
            google.maps.event.trigger(this.map, "resize");
            this.map.setCenter(this.map.getCenter());
          }
        });
      }
    },

    // -----------------------------
    // Google Maps ロード
    // -----------------------------
    async loadGoogleMaps() {
      if (this.googleMapsLoaded || window.google?.maps) {
        this.googleMapsLoaded = true;
        return;
      }

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

      await new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = mapUrl;
        script.async = true;
        script.defer = true;
        script.onload = () => {
          this.googleMapsLoaded = true;
          resolve();
        };
        document.head.appendChild(script);
      });
    },

    // -----------------------------
    // 地図初期化
    // -----------------------------
    async initMap() {
      await this.loadGoogleMaps();

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
      this.addCurrentLocationButton();   // ★ 復活
    },

    // -----------------------------
    // 現在地ボタン（復活）
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
    // 全件プロット（非選択＝黄色●、選択＝赤ピン）
    // -----------------------------
    addAllMarkers(selectedId) {
      this.markers.forEach(m => m.setMap(null));
      this.markers = [];

      this.houses.forEach((h) => {
        if (!h.CSVLat || !h.CSVLng) return;

        const isSelected = h.ID === selectedId;

        const icon = isSelected
          ? "http://maps.google.com/mapfiles/ms/icons/red-dot.png"
          : {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 7,
              fillColor: "#FFD700",   // ★ 黄色
              fillOpacity: 1,
              strokeWeight: 1,
              strokeColor: "#CCAA00"
            };

        const marker = new google.maps.Marker({
          position: { lat: Number(h.CSVLat), lng: Number(h.CSVLng) },
          map: this.map,
          icon,
          label: {
            text: String(h.ID),
            color: isSelected ? "#d00" : "#555",
            fontSize: "12px",
            fontWeight: "bold",
          },
        });

        marker.addListener("click", () => {
          this.focusOnMap(h);   // InfoWindow を開くだけ
        });

        this.markers.push(marker);
      });
    },

    // -----------------------------
    // InfoWindow（最新3件は表示しない）
    // -----------------------------
    async focusOnMap(house) {
      this.focusedId = house.ID;

      if (!this.mapOpen) {
        this.mapOpen = true;
        await this.$nextTick();
        if (!this.map) {
          await this.initMap();
        }
      }

      this.addAllMarkers(house.ID);

      const pos = {
        lat: Number(house.CSVLat),
        lng: Number(house.CSVLng),
      };

      this.map.panTo(pos);
      this.map.setZoom(17);

      const html = `
        <div style="font-size:13px; max-width:240px;">
          <strong>${house.FamilyName || "（表札なし）"}さん</strong><br>
          <span>${house.Address || ""}</span><br>
          <span>ステータス: ${house.VisitStatus || "未訪問"}</span><br>

          <hr style="margin:6px 0;">
          <a href="javascript:void(0)" onclick="childMapApp.scrollToHouse(${house.ID})">
            ▶ この住戸カードへ移動
          </a>
        </div>
      `;

      this.infoWindow.setContent(html);
      this.infoWindow.setPosition(pos);
      this.infoWindow.open(this.map);
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

    scrollToMapAndFocus(house) {
      // 地図アコーディオンを開く
      if (!this.mapOpen) {
        this.mapOpen = true;
      }

      // 地図へスクロール
      this.$nextTick(() => {
        const mapEl = document.getElementById("mapContainer");
        if (mapEl) {
          mapEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }

        // スクロール後にピンを立てる
        setTimeout(() => {
          this.focusOnMap(house);
        }, 400);
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