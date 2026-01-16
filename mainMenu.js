// Firebaseの初期化
import { auth, onAuthStateChanged, signOut } from "./firebase.js";

new Vue({
  el: "#app",

  data: {
    userEmail: "",
    userGroup: "一般",
    userrole: 0
  },

  created() {
    onAuthStateChanged(auth, (user) => {
      if (!user) {
        window.location.href = "index.html";
        return;
      }

      // Firebase のユーザー情報
      this.userEmail = user.email;

      // ★必要なら Firestore からユーザー情報を取得して userGroup / userrole を更新
      // 今は仮の値
      this.userGroup = "Group A";
      this.userrole = 1100;
    });
  },

  methods: {
    logout() {
      signOut(auth).then(() => {
        window.location.href = "index.html";
      });
    },

    go(page) {
      // GitHub Pages 用の遷移
      window.location.href = page + ".html";
    }
  }
});