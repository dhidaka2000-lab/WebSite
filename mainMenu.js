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
        // ★★★ 今は GAS に問い合わせず localStorage から読むだけ ★★★
        this.username  = localStorage.getItem("loginUserName")  ?? "";
        this.userEmail = localStorage.getItem("loginUserEmail") ?? "";
        this.userGroup = localStorage.getItem("loginUserGroup") ?? "";

        // ★★★ Role が返ってくる場合に備えて（将来の拡張用）★★★
        const savedRole = localStorage.getItem("loginUserRole");
        if (savedRole !== null) {
          this.userrole = Number(savedRole);
        } else {
          this.userrole = 0; // fallback
        }

      } catch (err) {
        // ★★★ try/catch を残す（将来 GAS に問い合わせる時のため）★★★
        console.error("ユーザー情報取得エラー:", err);
        alert("ユーザー情報の読み込み中にエラーが発生しました");
      } finally {
        // ★★★ 成功でも失敗でもローディング終了 ★★★
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