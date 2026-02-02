// ChildMap.js
//
// Vue 本体（司令塔）
// API: ApiMethods
// MAP: MapMethods

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
      _initialCenterHouse: null,

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

      // 一覧側のフォーカス
      focusedHouseId: null,

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
    // 一覧側のフォーカス制御
    // -----------------------------
    scrollToHouse(houseId) {
      this.focusedHouseId = houseId;

      this.$nextTick(() => {
        const el = document.getElementById(`house-${houseId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });

      // 地図を閉じる
      $('#mapModal').modal('hide');
    },

    // -----------------------------
    // 訪問履歴トグル
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

    // -----------------------------
    // 画面遷移
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

    // -----------------------------
    // API メソッド（B ファイル）
    // -----------------------------
    ...ApiMethods,

    // -----------------------------
    // 地図メソッド（C ファイル）
    // -----------------------------
    ...MapMethods,
  },
};

Vue.createApp(ChildMapApp).mount("#childMapApp");