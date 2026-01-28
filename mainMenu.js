import { auth, onAuthStateChanged, signOut } from "./firebase.js";

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
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "index.html";
        return;
      }

      try {
        // ★★★ localStorage から読み込むだけ（高速）★★★
        this.username  = localStorage.getItem("loginUserName")  ?? "";
        this.userEmail = localStorage.getItem("loginUserEmail") ?? "";
        this.userGroup = localStorage.getItem("loginUserGroup") ?? "";

        // ★★★ Role が返ってくる場合に備えて（将来の拡張用）★★★
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
      signOut(auth).then(() => {
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