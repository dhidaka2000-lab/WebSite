// ChildMap.js（IDボタン連動＋全件灰色●＋選択だけ赤ピン＋IDラベル＋InfoWindow最新3件＋訪問履歴アコーディオン）

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
    parseQuery() {
      const params = new URLSearchParams(window.location.search);
      this.cardNo = params.get("cardNo");
      this.childNo = params.get("childNo");
      this.loginUser = params.get("loginUser");
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
      }
    },

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
      this.addCurrentLocationButton();
    },

    // ★ マーカーに ID ラベルを付ける
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
              scale: 6,
              fillColor: "#888",
              fillOpacity: 1,
              strokeWeight: 0,
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
          this.focusOnMap(h);
          this.scrollToHouse(h.ID);
        });

        this.markers.push(marker);
      });
    },

    //