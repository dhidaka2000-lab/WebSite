// ChildMap.api.js
//
// Cloudflare Worker API 通信専用モジュール
// Vue 本体（ChildMap.js）で ...ApiMethods として取り込む

const ApiMethods = {
  /**
   * 子カード詳細を取得
   */
  async fetchChildDetail() {
    this.loading = true;
    try {
      const user = firebase.auth().currentUser;
      if (!user) throw new Error("Not authenticated");

      const idToken = await user.getIdToken();

      const payload = {
        funcName: "getChildDetail",
        cardNo: this.cardNo,
        childNo: this.childNo,
        loginUser: this.loginUser || user.email || "",
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
      if (data.status && data.status !== "success") {
        throw new Error(data.message || "API error");
      }

      // Vue 側のデータに反映
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

  /**
   * 訪問結果を保存
   */
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
        cardNo: this.cardNo,
        childNo: this.childNo,
        DetailID: this.selectedHouse.ID,
        loginUser: this.loginUser || user.email || "",
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
      if (data.status && data.status !== "success") {
        throw new Error(data.message || "API error");
      }

      // 最新データを再取得
      await this.fetchChildDetail();

      // モーダルを閉じる
      $("#resultModal").modal("hide");
    } catch (err) {
      console.error(err);
      alert("訪問結果の保存に失敗しました。");
    } finally {
      this.savingResult = false;
    }
  },
};