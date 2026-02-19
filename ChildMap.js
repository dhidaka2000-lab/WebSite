// ChildMap.js（Supabase＋Worker＋安全な Google Maps 対応版）

const ChildMapApp = {
  data() {
    return {
      loading: true,
      savingResult: false,

      map: null,
      markers: [],
      activeMarker: null,
      infoWindow: null,
      focusedHouseId: null,

      cardNo: null,
      childNo: null,
      loginUser: null,

      cardInfo: {},
      childInfo: {},
      houses: [],

      openVisitHistoryIds: new Set(),
      selectedHouse: null,
      resultForm: {
        result: "",
        comment: "",
      },

      searchQuery: "",

      // ★ Worker のエンドポイント（固定）
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
    // Supabase（Worker 経由）
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
    // 訪問履歴の開閉
    // -----------------------------
    toggleVisitHistory(id) {
      if (this.openVisitHistoryIds.has(id)) {
        this.openVisitHistoryIds.delete(id);
      } else {
        this.openVisitHistoryIds.add(id);
      }
      this.openVisitHistoryIds = new Set(this.openVisitHistoryIds);
    },

    isVisitHistoryOpen(id) {
      return this.openVisitHistoryIds.has(id);
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
    },

    // -----------------------------
    // Google Maps（安全版）
    // -----------------------------
    async openMapModal(house) {
      this.focusedHouseId = house.ID;

      // ★ Worker から安全な Google Maps script URL を取得
      const urlRes = await fetch(
        `${this.apiEndpoint}?funcName=getGoogleMapsUrl`
      );
      const { mapUrl } = await urlRes.json();

      // ★ 動的に Google Maps script を読み込む
      const script = document.createElement("script");
      script.src = mapUrl;
      script.async = true;
      script.defer = true;
      script.onload = () => this.initMap(house);
      document.body.appendChild(script);

      $("#mapModal").modal("show");
    },

    initMap(house) {
      this.map = new google.maps.Map(
        document.getElementById("mapModalContainer"),
        {
          center: { lat: house.Lat, lng: house.Lng },
          zoom: 18,
        }
      );

      new google.maps.Marker({
        position: { lat: house.Lat, lng: house.Lng },
        map: this.map,
      });
    },

    scrollToHouse(houseId) {
      this.focusedHouseId = houseId;

      this.$nextTick(() => {
        const el = document.getElementById(`house-${houseId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });

      $("#mapModal").modal("hide");
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

Vue.createApp(ChildMapApp).mount("#childMapApp");