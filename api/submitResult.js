// api/submitResult.js

function submitResult() {
  if (!this.selectedHouse) return;
  if (!this.resultForm.result) {
    alert("結果を選択してください。");
    return;
  }

  this.savingResult = true;

  (async () => {
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

      await this.fetchChildDetail();
      $("#resultModal").modal("hide");
    } catch (err) {
      console.error(err);
      alert("訪問結果の保存に失敗しました。");
    } finally {
      this.savingResult = false;
    }
  })();
}