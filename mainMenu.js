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
        const idToken = await user.getIdToken(true);

        const response = await fetch("https://ekuikidev.dhidaka2000.workers.dev", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + idToken
          },
          body: JSON.stringify({
            funcName: "getLoginUserInformation"
          })
        });

        const data = await response.json();
        console.log("ログインユーザー情報:", data);

        if (data.status !== "success") {
          alert("ユーザー情報の取得に失敗しました");
          return;
        }

        // ★★★ localStorage に保存 ★★★
        localStorage.setItem("loginUserName", data.userName);
        localStorage.setItem("loginUserEmail", data.email);
        localStorage.setItem("loginUserUID", data.uid);
        localStorage.setItem("loginUserGroup", data.group);

        // ★★★ Vue に反映 ★★★
        this.username = data.userName;
        this.userEmail = data.email;
        this.userGroup = data.group;

        // ★★★ Role が返ってくる場合に備えて ★★★
        if (data.role !== undefined) {
          this.userrole = Number(data.role);
          localStorage.setItem("loginUserRole", data.role);
        } else {
          this.userrole = 0; // fallback
        }

      } catch (err) {
        console.error("ユーザー情報取得エラー:", err);
        alert("通信エラーが発生しました");
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