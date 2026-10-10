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
      <article class="hobby-card${hobby.title === "Woodworking" ? " woodworking-card" : ""}"${hobby.title === "Woodworking" ? ' role="button" tabindex="0" aria-controls="woodworking-album" aria-expanded="false"' : ""}>
        <p class="card-number">${hobby.number}</p>
        <h3>${hobby.title}</h3>
        <p>${hobby.description}</p>
        ${hobby.title === "Woodworking" ? '<span class="slideshow-hint">View photo album <span aria-hidden="true">↗</span></span>' : ""}
      </article>`).join("");
  }

  const woodworkingAlbum = document.querySelector('[data-section="woodworking"]');
  if (woodworkingAlbum && content.woodworking) {
    const wood = content.woodworking;
    woodworkingAlbum.innerHTML = `
      <div class="woodworking-slideshow" id="woodworking-album" role="region" aria-label="Woodworking photo album" aria-roledescription="carousel" tabindex="-1">
        <div class="woodworking-slides">
          ${wood.photos.map((photo, index) => `
            <figure class="woodworking-slide${index === 0 ? " is-active" : ""}" aria-hidden="${index !== 0}"${index !== 0 ? " inert" : ""}>
              <img src="${photo.src}" alt="${photo.alt}">
              <figcaption>${photo.caption}</figcaption>
            </figure>`).join("")}
          <figure class="woodworking-slide" aria-hidden="true" inert>
            <img src="${wood.profileImage}" alt="${wood.profileAlt}">
            <figcaption>In the shop</figcaption>
          </figure>
        </div>
        <div class="slideshow-controls">
          <button class="slideshow-button" type="button" data-slide="previous" aria-label="Previous photo">&#8592;</button>
          <p class="slideshow-count" aria-live="polite"><span data-slide-current>1</span> / ${wood.photos.length + 1}</p>
          <button class="slideshow-button" type="button" data-slide="next" aria-label="Next photo">&#8594;</button>
        </div>
      </div>
      <div class="woodworking-intro">
        <div>
          <p class="eyebrow">${wood.eyebrow}</p>
          <h3>${wood.title}</h3>
          <p>${wood.intro}</p>
        </div>
        <img src="${wood.profileImage}" alt="${wood.profileAlt}" loading="lazy">
      </div>
      `;
    woodworkingAlbum.hidden = true;

    const woodworkingCard = hobbyList?.querySelector(".woodworking-card");
    const toggleAlbum = () => {
      if (!woodworkingCard) return;
      const isOpen = woodworkingCard.getAttribute("aria-expanded") === "true";
      woodworkingCard.setAttribute("aria-expanded", String(!isOpen));
      woodworkingAlbum.hidden = isOpen;
      if (!isOpen) {
        woodworkingAlbum.querySelector(".woodworking-slideshow").focus();
      }
    };
    woodworkingCard?.addEventListener("click", toggleAlbum);
    woodworkingCard?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleAlbum();
      }
    });

    const slides = [...woodworkingAlbum.querySelectorAll(".woodworking-slide")];
    let currentSlide = 0;
    const showSlide = (index) => {
      currentSlide = (index + slides.length) % slides.length;
      slides.forEach((slide, slideIndex) => {
        const active = slideIndex === currentSlide;
        slide.classList.toggle("is-active", active);
        slide.setAttribute("aria-hidden", String(!active));
        slide.inert = !active;
      });
      woodworkingAlbum.querySelector("[data-slide-current]").textContent = String(currentSlide + 1);
    };
    woodworkingAlbum.querySelector('[data-slide="previous"]').addEventListener("click", () => showSlide(currentSlide - 1));
    woodworkingAlbum.querySelector('[data-slide="next"]').addEventListener("click", () => showSlide(currentSlide + 1));
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

