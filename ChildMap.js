// childMap.js

// ==============================
// Firebase 初期化
// ==============================
/*
  ※ 実際の値に差し替えてください
*/
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "ekuikidev.firebaseapp.com",
  projectId: "ekuikidev",
  storageBucket: "ekuikidev.appspot.com",
  messagingSenderId: "896828437660",
  appId: "1:896828437660:web:3c3154fd640a522e0fe959",
};

if (!firebase.apps || firebase.apps.length === 0) {
  firebase.initializeApp(firebaseConfig);
}

// ==============================
// Vue アプリ本体
// ==============================
const ChildMapApp = {
  data() {
    return {
      loading: true,
      savingResult: false,
      mapActive: false,
      map: null,
      kmlLayer: null,
      marker: null,

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

      // ★ Cloudflare Worker の URL（GAS ではなく Worker を叩く）
      apiEndpoint: "https://YOUR-WORKER-SUBDOMAIN.YOUR-DOMAIN.workers.dev",
    };
  },

  async mounted() {
    this.parseQuery();

    // Firebase ログイン状態の確認
    firebase.auth().onAuthStateChanged(async (user) => {
      if (!user) {
        alert("ログイン情報が失われました。ログインし直してください。");
        window.location.href = "./index.html";
        return;
      }
      // ログイン済みなら子カード情報取得
      await this.fetchChildDetail();
    });
  },

  methods: {
    // URL パラメータ取得
    parseQuery() {
      const params = new URLSearchParams(window.location.search);
      this.cardNo = params.get("cardNo");
      this.childNo = params.get("childNo");
      this.loginUser = params.get("loginUser"); // 任意（メールアドレスなど）
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
          CardNo: this.cardNo,
          ChildNo: this.childNo,
          LOGINUSER: this.loginUser || user.email || "",
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
        if (data.status !== "success") {
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

    // マップ表示切替
    toggleMap() {
      this.mapActive = !this.mapActive;

      if (this.mapActive && !this.map) {
        let lat = parseFloat(this.childInfo.CSVLat || 34.6937);
        let lng = parseFloat(this.childInfo.CSVLng || 135.5023);
        this.initMap(lat, lng, this.childInfo.KMLURL);
      }
    },

    // Google マップ初期化
    initMap(lat, lng, kmlUrl) {
      const mapEl = document.getElementById("map");
      if (!mapEl || !window.google) return;

      this.map = new google.maps.Map(mapEl, {
        center: { lat, lng },
        zoom: 16,
      });

      if (kmlUrl) {
        this.kmlLayer = new google.maps.KmlLayer({
          url: kmlUrl,
          map: this.map,
          preserveViewport: true,
        });
      }

      this.marker = new google.maps.Marker({
        position: { lat, lng },
        map: this.map,
      });
    },

    // 住戸をマップでフォーカス
    focusOnHouse(house) {
      if (!this.mapActive) {
        this.mapActive = true;
        this.$nextTick(() => {
          this.initMap(
            parseFloat(house.CSVLat),
            parseFloat(house.CSVLng),
            this.childInfo.KMLURL
          );
        });
        return;
      }

      const pos = {
        lat: parseFloat(house.CSVLat),
        lng: parseFloat(house.CSVLng),
      };

      this.map.setCenter(pos);
      this.map.setZoom(18);
      if (this.marker) {
        this.marker.setPosition(pos);
      } else {
        this.marker = new google.maps.Marker({
          position: pos,
          map: this.map,
        });
      }
    },

    // 訪問履歴トグル
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

    // 結果入力モーダル
    openResultModal(house) {
      this.selectedHouse = house;
      this.resultForm.result = "";
      this.resultForm.comment = "";
      $("#resultModal").modal("show");
    },

    // Worker 経由で saveVisitResult 呼び出し
    async submitResult() {
      if (!this.selectedHouse) return;
      if (!this.resultForm.result) {
        alert("結果を選択してください。");
        return;
      }

      this.savingResult = true;

      try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error("Not authenticated");

        const idToken = await user.getIdToken();

        const payload = {
          funcName: "saveVisitResult",
          CardNo: this.cardNo,
          ChildNo: this.childNo,
          DetailID: this.selectedHouse.ID,
          LOGINUSER: this.loginUser || user.email || "",
          Result: this.resultForm.result,
          Comment: this.resultForm.comment,
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
        if (data.status !== "success") {
          throw new Error(data.message || "API error");
        }

        await this.fetchChildDetail();
        $("#resultModal").modal("hide");
      } catch (err) {
        console.error(err);
        alert("訪問結果の保存に失敗しました。");
      } finally {
        this.savingResult = false;
      }
    },

    // 画面遷移
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