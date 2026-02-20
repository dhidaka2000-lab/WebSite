const app = Vue.createApp({
  data() {
    return {
      userEmail: "",
      username: "",
      userGroup: "",
      userrole: 0,
      loading: true,

      apiEndpoint: "https://ekuikidev.dhidaka2000.workers.dev",
    };
  },

  async created() {
    // ★ Firebase API Key を Worker から取得
    const firebaseConfig = await this.fetchFirebaseConfig();
    firebase.initializeApp(firebaseConfig);

    firebase.auth().onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = "index.html";
        return;
      }

      try {
        this.username  = localStorage.getItem("loginUserName")  ?? "";
        this.userEmail = localStorage.getItem("loginUserEmail") ?? "";
        this.userGroup = localStorage.getItem("loginUserGroup") ?? "";

        const savedRole = localStorage.getItem("loginUserRole");
        this.userrole = savedRole !== null ? Number(savedRole) : 0;

      } catch (err) {
        console.error("ユーザー情報取得エラー:", err);
        alert("ユーザー情報の読み込み中にエラーが発生しました");
      } finally {
        this.loading = false;
      }
    });
  },

  methods: {
    async fetchFirebaseConfig() {
      const res = await fetch(this.apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ funcName: "getFirebaseConfig" }),
      });

      const data = await res.json();
      return {
        apiKey: data.apiKey,
        authDomain: "ekuikidev.firebaseapp.com",
        projectId: "ekuikidev",
      };
    },

    logout() {
      firebase.auth().signOut().then(() => {
        localStorage.clear();
        window.location.href = "index.html";
      });
    },

    go(page) {
      window.location.href = page + ".html";
    }
  }
});

app.mount("#app");