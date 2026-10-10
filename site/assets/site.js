(function () {
  const content = window.RUSTIN_SITE;
  if (!content) return;

  document.querySelectorAll("[data-content]").forEach((element) => {
    const value = content[element.dataset.content];
    if (typeof value === "string") element.textContent = value;
  });

  const hobbyList = document.querySelector('[data-list="hobbies"]');
  if (hobbyList) {
    hobbyList.innerHTML = content.hobbies.map((hobby) => `
      <article class="hobby-card">
        <p class="card-number">${hobby.number}</p>
        <h3>${hobby.title}</h3>
        <p>${hobby.description}</p>
      </article>`).join("");
  }

  const woodworkingAlbum = document.querySelector('[data-section="woodworking"]');
  if (woodworkingAlbum && content.woodworking) {
    const wood = content.woodworking;
    woodworkingAlbum.innerHTML = `
      <div class="woodworking-intro">
        <div>
          <p class="eyebrow">${wood.eyebrow}</p>
          <h3>${wood.title}</h3>
          <p>${wood.intro}</p>
        </div>
        <img src="${wood.profileImage}" alt="${wood.profileAlt}" loading="lazy">
      </div>
      <div class="woodworking-album">
        ${wood.photos.map((photo) => `
          <figure class="woodworking-photo">
            <img src="${photo.src}" alt="${photo.alt}" loading="lazy">
            <figcaption>${photo.caption}</figcaption>
          </figure>`).join("")}
      </div>`;
  }

  const socialList = document.querySelector('[data-list="socials"]');
  if (socialList) {
    socialList.innerHTML = content.socials.map((social) => {
      const isPlaceholder = social.url === "#";
      const attributes = isPlaceholder ? 'aria-disabled="true"' : 'target="_blank" rel="noreferrer"';
      return `<a class="social-link${isPlaceholder ? " placeholder" : ""}" href="${social.url}" ${attributes}>
        <span>${social.label}</span><span>${social.handle}</span><span aria-hidden="true">↗</span>
      </a>`;
    }).join("");
  }

  document.querySelectorAll('a[href="#"][aria-disabled="true"]').forEach((link) => {
    link.addEventListener("click", (event) => event.preventDefault());
  });
})();

