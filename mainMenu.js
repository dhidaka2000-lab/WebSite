// ★ フロント側は Firebase Web SDK を使うので import は不要 ★
// import { auth, onAuthStateChanged, signOut } from "./firebase.js";

const app = Vue.createApp({
  data() {
    return {
      userEmail: "",
      username: "",
      userGroup: "",
      userrole: 0,
      loading: true
    };
  },

  created() {
    // Firebase Web SDK の onAuthStateChanged を使用
    firebase.auth().onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = "index.html";
        return;
      }

      try {
        // ★ localStorage から高速読み込み ★
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
    logout() {
      firebase.auth().signOut().then(() => {
        localStorage.removeItem("loginUserName");
        localStorage.removeItem("loginUserEmail");
        localStorage.removeItem("loginUserUID");
        localStorage.removeItem("loginUserGroup");
        localStorage.removeItem("loginUserRole");

        window.location.href = "index.html";
      });
    },

    go(page) {
      window.location.href = page + ".html";
    }
  }
});

app.mount("#app");