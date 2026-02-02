// map/highlightMarker.js

function getMarkerIcon(status) {
  const colors = {
    "在宅": "green",
    "不在": "yellow",
    "NG": "red",
    "保留": "gray",
  };

  const color = colors[status] || "gray";

  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: color,
    fillOpacity: 0.9,
    strokeColor: "white",
    strokeWeight: 1,
    scale: 8,
  };
}

function highlightMarker(marker) {
  if (this.activeMarker && this.activeMarker !== marker) {
    const hPrev = this.activeMarker.houseData;
    this.activeMarker.setIcon(this.getMarkerIcon(hPrev.VisitStatus));
  }

  marker.setIcon("http://maps.google.com/mapfiles/ms/icons/red-dot.png");
  this.activeMarker = marker;

  const h = marker.houseData;

  const content = `
    <div id="infowindow-content" style="font-size:14px; cursor:pointer;">
      <strong>${h.FamilyName || '世帯名なし'}</strong><br>
      ${h.Address || ''}
      <div style="margin-top:4px; font-size:12px; color:#007bff;">
        → この住戸へ移動
      </div>
    </div>
  `;

  this.infoWindow.setContent(content);
  this.infoWindow.open(this.map, marker);

  google.maps.event.addListenerOnce(this.infoWindow, "domready", () => {
    const el = document.getElementById("infowindow-content");
    if (el) {
      el.addEventListener("click", () => {
        this.scrollToHouse(h.ID);
      });
    }
  });
}