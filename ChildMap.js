// ChildMap.js

const ChildMapApp = {
  data() {
    return {
      loading: true,
      savingResult: false,

      // Google Maps
      map: null,
      kmlLayer: null,
      markers: [],
      activeMarker: null,
      infoWindow: null,

      // URL パラメータ
      cardNo: null,
      childNo: null,
      loginUser: null,

      // データ本体
      cardInfo: {},
      childInfo: {},
      houses: [],

      // UI 状態
      openVisitHistoryIds: new Set(),
      selectedHouse: null,
      resultForm: {
        result: "",
        comment: "",
      },

      // 検索
      searchQuery: "",

      // Cloudflare Worker の URL
      apiEndpoint: "https://ekuikidev.dhidaka2000.workers.dev",
    };
  },

  computed: {
    filteredHouses() {
      if (!this.searchQuery) return this.houses;

      const q = this.searchQuery.toLowerCase();

      return this.houses.filter(h =>
        (h.Address || "").toLowerCase().includes(q) ||
        (h.FamilyName || "").toLowerCase().includes(q) ||
        (h.BuildingName || "").toLowerCase().includes(q)
      );
    },
  },

  async mounted() {
    this.parseQuery();

    firebase.auth().onAuthStateChanged(async (user) => {
      if (!user) {
        alert("ログイン情報が失われました。ログインし直してください。");
        window.location.href = "./index.html";
        return;
      }
      await this.fetchChildDetail();
    });
  },

  methods: {
    // URL パラメータ取得
    parseQuery() {
      const params = new URLSearchParams(window.location.search);
      this.cardNo = params.get("cardNo");
      this.childNo = params.get("childNo");
      this.loginUser = params.get("loginUser");
    },

    // Worker 経由で getChildDetail 呼び出し
    async fetchChildDetail() {
      this.loading = true;
      try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error("Not authenticated");

        const idToken = await user.getIdToken();

        const payload = {
          funcName: "getChildDetail",
          cardNo: this.cardNo,
          childNo: this.childNo,
          loginUser: this.loginUser || user.email || "",
        };

        const res = await fetch(this.apiEndpoint, {
          method: "POST",
          mode: "cors",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (data.status && data.status !== "success") {
          throw new Error(data.message || "API error");
        }

        this.cardInfo = data.cardInfo || {};
        this.childInfo = data.childInfo || {};
        this.houses = data.houses || [];
      } catch (err) {
        console.error(err);
        alert("子カード情報の取得に失敗しました。");
      } finally {
        this.loading = false;
      }
    },

    // マーカーアイコン（VisitStatus による色分け）
    getMarkerIcon(status) {
      const colors = {
        "在宅": "green",
        "不在": "yellow",
        "NG": "red",
        "保留": "gray",
      };

      const color = colors[status] || "gray";

      return {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: color,
        fillOpacity: 0.9,
        strokeColor: "white",
        strokeWeight: 1,
        scale: 8,
      };
    },

    // 地図モーダルを開く
    openMapModal(house) {
      const lat = parseFloat(house.CSVLat || this.childInfo.CSVLat || 34.6937);
      const lng = parseFloat(house.CSVLng || this.childInfo.CSVLng || 135.5023);
      const kmlUrl = this.childInfo.KMLURL;

      $('#mapModal').modal('show');

      this.$nextTick(() => {
        const mapEl = document.getElementById("mapModalContainer");
        if (!mapEl || !window.google) return;

        this.map = new google.maps.Map(mapEl, {
          center: { lat, lng },
          zoom: 18,
        });

        this.infoWindow = new google.maps.InfoWindow();
        this.activeMarker = null;

        // KML レイヤー
        if (kmlUrl) {
          this.kmlLayer = new google.maps.KmlLayer({
            url: kmlUrl,
            map: this.map,
            preserveViewport: false,
          });

          google.maps.event.addListener(this.kmlLayer, "defaultviewport_changed", () => {
            const bounds = this.kmlLayer.getDefaultViewport();
            if (bounds) {
              this.map.fitBounds(bounds);
            }
          });
        }

        // 地図の idle 時に範囲内の住戸マーカーを更新
        google.maps.event.addListener(this.map, "idle", () => {
          this.updateVisibleHouses();
        });

        // 初期表示の住戸マーカー
        this.updateVisibleHouses(house);
      });
    },

    // 地図範囲内の住戸だけマーカー表示（赤ピン対応）
    updateVisibleHouses(centerHouse) {
      if (!this.map) return;

      const bounds = this.map.getBounds();
      if (!bounds) return;

      // 既存マーカー削除
      this.markers.forEach(m => m.setMap(null));
      this.markers = [];

      this.houses.forEach(house => {
        const lat = parseFloat(house.CSVLat);
        const lng = parseFloat(house.CSVLng);
        if (isNaN(lat) || isNaN(lng)) return;

        const pos = new google.maps.LatLng(lat, lng);

        if (bounds.contains(pos)) {
          const marker = new google.maps.Marker({
            position: pos,
            map: this.map,
            icon: this.getMarkerIcon(house.VisitStatus),
            title: house.Address || "",
          });

          marker.houseData = house;

          marker.addListener("click", () => {
            this.highlightMarker(marker);
          });

          this.markers.push(marker);
        }
      });

      // 初回表示の中心住戸
      if (centerHouse) {
        const lat = parseFloat(centerHouse.CSVLat);
        const lng = parseFloat(centerHouse.CSVLng);
        if (!isNaN(lat) && !isNaN(lng)) {
          this.map.setCenter({ lat, lng });
          this.map.setZoom(18);

          const target = this.markers.find(m => m.houseData.ID === centerHouse.ID);
          if (target) {
            this.highlightMarker