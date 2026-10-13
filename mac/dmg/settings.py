# Layout of the Pocket disk image window, used by dmgbuild (see build.sh).
# The background comes from design/make-dmg-background.swift; keep the positions in sync with it.
app = defines["app"]  # noqa: F821 (dmgbuild provides `defines`)

format = "UDZO"
filesystem = "HFS+"
size = None
files = [app]
symlinks = {"Applications": "/Applications"}
hide_extensions = ["Pocket.app"]
icon_locations = {"Pocket.app": (170, 190), "Applications": (470, 190)}

background = defines["background"]  # noqa: F821 (a 1x + 2x TIFF made by build.sh)
window_rect = ((200, 160), (640, 400))
default_view = "icon-view"
show_status_bar = False
show_tab_view = False
show_toolbar = False
show_pathbar = False
show_sidebar = False
icon_size = 112
text_size = 13
arrange_by = None
