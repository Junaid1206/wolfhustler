function requireAdmin(req, res, next) {
  if (req.session && req.session.adminId) {
    return next();
  }
  return res.status(401).json({ error: "Not logged in" });
}

// Same check, but for routes hit by direct browser navigation (like clicking
// "Connect Pinterest") rather than fetch() — redirects instead of returning JSON.
function requireAdminPage(req, res, next) {
  if (req.session && req.session.adminId) {
    return next();
  }
  return res.redirect("/admin/login.html");
}

module.exports = requireAdmin;
module.exports.requireAdminPage = requireAdminPage;
