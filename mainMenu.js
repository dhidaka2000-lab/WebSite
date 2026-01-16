import { auth, onAuthStateChanged, signOut } from "./firebase.js";

const app = Vue.createApp({
  data() {
    return {
      userEmail: "",
      userGroup: "（なし）",
      userrole: 0
    };
  },

  created() {
    onAuthStateChanged(auth, (user) => {
      if (!user) {
        window.location.href = "index.html";
        return;
      }

      this.userEmail = user.email;

      // ★必要なら Firestore から取得
      this.userGroup = "いちじく";
      this.userrole = 9001;
    });
  },

  methods: {
    logout() {
      signOut(auth).then(() => {
        window.location.href = "index.html";
      });
    },

    go(page) {
      window.location.href = page + ".html";
    }
  }
});

app.mount("#app");