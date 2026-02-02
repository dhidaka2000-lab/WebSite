// ChildMap.js

const ApiMethods = {
  fetchChildDetail,
  submitResult,
};

const MapMethods = {
  openMapModal,
  updateVisibleHouses,
  highlightMarker,
  getMarkerIcon,
};

const ChildMapApp = {
  data() {
    return {
      loading: true,
      savingResult: false,

      map: null,
      kmlLayer: null,
      markers: [],
      activeMarker: null,
      infoWindow: null,
      _initialCenterHouse: null,

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
      focusedHouseId: null,

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

  mounted() {
    this.parseQuery();

    firebase.auth().onAuthStateChanged(async (user) => {
      if (!user) {
        alert("ログイン情報が失われました。ログインし直してください。");
        window.location.href = "./index.html";
        return;
      }
      this.fetchChildDetail();
    });
  },

  methods: {
    parseQuery() {
      const params = new URLSearchParams(window.location.search);
      this.cardNo = params.get("cardNo");
      this.childNo = params.get("childNo");
      this.loginUser = params.get("loginUser");
    },

    scrollToHouse(houseId) {
      this.focusedHouseId = houseId;

      this.$nextTick(() => {
        const el = document.getElementById(`house-${houseId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });

      $('#mapModal').modal('hide');
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

    ...ApiMethods,
    ...MapMethods,
  },
};

Vue.createApp(ChildMapApp).mount("#childMapApp");