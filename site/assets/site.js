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

