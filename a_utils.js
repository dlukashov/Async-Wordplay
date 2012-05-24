function slugify(s) {
      s = s.replace(/[^\w\s-]/g, '').trim().toLowerCase();
      s = s.replace(/[-\s]+/g, '-');
      return s;
}
