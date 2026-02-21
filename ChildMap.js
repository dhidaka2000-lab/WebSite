// ChildMap.js（Supabase＋Worker＋Google Maps 安定版）

const ChildMapApp = {
  data() {
    return {
      loading: true,
      savingResult: false,

      map: null,
      selectedHouse: null,
      googleMapsLoaded: false,

      cardNo: null,
      childNo: null,
      loginUser: null,

      cardInfo: {},
      childInfo: {},
      houses: [],

      openVisitHistoryIds: new Set(),
      resultForm: {
        result: "",
        comment: "",
      },

      searchQuery: "",

      apiEndpoint: "https://ekuikidev.dhidaka2000.workers.dev",
    };
  },

  computed: {
    filteredHouses() {
      if (!this.houses) return [];
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

    // ★ モーダルが開いた瞬間に地図を描画
    $('#mapModal').on('shown.bs.modal', () => {
      if (this.selectedHouse) {
        this.initMapAfterModal();
      }
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
    // Google Maps（認証付きロード）
    // -----------------------------
    async loadGoogleMaps() {
      if (this.googleMapsLoaded) return;

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
        script.onload = resolve;
        document.head.appendChild(script);
      });

      this.googleMapsLoaded = true;
    },

    async openMapModal(house) {
      this.selectedHouse = house;
      $("#mapModal").modal("show");
    },

    async initMapAfterModal() {
      await this.loadGoogleMaps();

      const lat = Number(this.selectedHouse.CSVLat);
      const lng = Number(this.selectedHouse.CSVLng);

      if (!lat || !lng) {
        console.warn("座標がありません:", this.selectedHouse);
        return;
      }

      this.map = new google.maps.Map(
        document.getElementById("mapModalContainer"),
        {
          center: { lat, lng },
          zoom: 18,
        }
      );

      new google.maps.Marker({
        position: { lat, lng },
        map: this.map,
      });
    },

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