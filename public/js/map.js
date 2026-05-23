(function () {
    const dataEl  = document.getElementById("map-data");
    if (!dataEl) return;

    const mapToken = dataEl.dataset.token;
    // decodeURIComponent reverses the encodeURIComponent applied in the template
    const listing  = JSON.parse(decodeURIComponent(dataEl.dataset.listing));

    if (!mapToken || !listing?.geometry?.coordinates) {
        console.warn("Map: missing token or geometry data.");
        return;
    }

    mapboxgl.accessToken = mapToken;

    const map = new mapboxgl.Map({
        container: "map",
        style:     "mapbox://styles/mapbox/light-v11",
        center:    listing.geometry.coordinates,
        zoom:      9,
    });

    map.addControl(new mapboxgl.NavigationControl(), "bottom-right");

    new mapboxgl.Marker({ color: "#C0602A" })
        .setLngLat(listing.geometry.coordinates)
        .setPopup(
            new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(
                `<div style="font-family:'DM Sans',sans-serif;padding:4px 2px">
                    <strong style="font-size:0.875rem">${listing.title}</strong><br>
                    <span style="font-size:0.78rem;color:#888">Exact address shared after booking</span>
                </div>`
            )
        )
        .addTo(map);
})();