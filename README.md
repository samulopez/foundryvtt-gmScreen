# GM Screen

![Latest Release Download Count](https://img.shields.io/badge/dynamic/json?label=Downloads@latest&query=assets%5B1%5D.download_count&url=https%3A%2F%2Fapi.github.com%2Frepos%2Fsamulopez%2Ffoundryvtt-gmScreen%2Freleases%2Flatest)
![Foundry Core Compatible Version](https://img.shields.io/badge/dynamic/json.svg?url=https%3A%2F%2Fraw.githubusercontent.com%2Fsamulopez%2Ffoundryvtt-gmScreen%2Fmain%2Fsrc%2Fmodule.json&label=Foundry%20Version&query=$.compatibility.verified&colorB=orange)

This fork wouldn't exist without ElfFriend-DnD's work on the main repository.

[![ko-fi](https://img.shields.io/badge/-buy%20him%20a%20coke-%23FF5E5B)](https://ko-fi.com/elffriend)
[![patreon](https://img.shields.io/badge/-patreon-%23FF424D)](https://www.patreon.com/ElfFriend_DnD)

![GM Screen Cover Image](readme-img/cover-image.png)

Creates a tabbed modular grid that GMs can populate with journal entries, journal pages, rollable tables, actors, and items. Customize your "GM Screen" by dragging and dropping items into cells and have its information available at any time from a button on the bottom right of the UI, near the sidebar. Roll rollable tables, open linked entities, and even place actor sheets into these cells. Obviously the space constraints mean some sheets will work better than others.

Additionally, any screen you create as GM can be set to be shared with players, so you can provide them with a cheat sheet that is always readily available to them. Be sure you set the permissions correctly on the entities themselves before trying to share them with players on a screen!

## Installation

To install, search for "GM Screen" in your module browser inside Foundry VTT.

Alternatively, you can manually install the module by following these steps:

1. Inside Foundry, select the Game Modules tab in the Configuration and Setup menu.
2. Click the Install Module button and enter the following URL: https://github.com/samulopez/foundryvtt-gmScreen/releases/latest/download/module.json

3. Click Install and wait for installation to complete.

## Usage

<video src="readme-img/tab-config-demo.mp4" alt="Tab Configuration Demo Video"></video>

- Set up tabs in the Module Settings, and optionally share some with your players.
- Drag and drop Journal Entries, Journal Pages, Rollable Tables, even Actors and Items into cells on the GM Screen.
- Each cell has settings which allow for that cell to span multiple columns or rows.
- Clicking the little icon on the top-right of the cell will pop out the full-sized sheet for whatever entity is in the cell. The GM Screen is intended to be read-only, so edits to things inside it will happen for the most part by popping the entity out.
- Tabs can be reordered from the settings.

## Screenshots

### GM View

![GM Screen Grid Tab with Combat information.](readme-img/combat-tab.png)
![GM Screen Grid Tab with Rules information.](readme-img/rules-tab.png)
![GM Screen Grid Tab with Notes information.](readme-img/notes-tab.png)
![GM Screen Grid Tab with a Player Cheat Sheet.](readme-img/cheat-sheet-tab.png)

### Player View (with a tab set to be shared)

![Demonstration of the GM Screen Grid from the player's perspective.](readme-img/cheet-sheet-player.png)

## Configuration

![Screenshot of the GM Screen Configuration](readme-img/settings.png)

| **Name**                       | Scope  | Default | Description                                                                                                                                                                                         |
| ------------------------------ | :----: | :-----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Grid Tabs**                  | world  |  Menu   | Allows the user to configure multiple tabs of the grid. Each grid tab created can have its own Column Override and Row Override if the default setting isn't what you want for that particular tab. |
| **Columns**                    | world  |    4    | Sets the number of columns in the grid.                                                                                                                                                             |
| **Rows**                       | world  |    3    | Sets the number of rows in the grid.                                                                                                                                                                |
| **Display as Drawer**          | client |  true   | Controls whether the GM Screen appears as a normal popup dialog or as a drawer. To use the PopOut module with the GM Screen, this needs to be unchecked.                                            |
| Drawer Only: **Right Margin**  | client |  0(vw)  | Sets the offset from the sidebar to the right side of the GM Screen. This number affects the maximum possible width of the screen.                                                                  |
| Drawer Only: **Height**        | client | 60(vh)  | Sets the height of the GM Screen Drawer.                                                                                                                                                            |
| Drawer Only: **Width**         | client | 100(%)  | Calculated as a percentage of the available screen width after the sidebar and right margin are taken into account.                                                                                 |
| Drawer Only: **Opacity**       | client | 100(%)  | Controls how opaque the drawer is.                                                                                                                                                                  |
| **Condensed GM Screen Button** | client |  false  | Removes the text from the GM Screen Button.                                                                                                                                                         |
| **Reset Grid**                 | world  |  false  | Saving with this checkbox checked will reset the grid (useful if you end up somehow causing it to fail to render).                                                                                  |

Note that changing the grid dimensions after populating the grid might cause unexpected results, and odds are you will have to clear the grid and repopulate things.

### Tab Configuration

![Screenshot of the GM Screen Tab Configuration](readme-img/tab-config.png)

| **Name**             | Description                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Tab Label**        | The name of this tab, this is visible to players if the tab is shared.                                                               |
| **Columns Override** | Override the number of columns in this specific grid tab.                                                                            |
| **Rows Override**    | Override the number of rows in this specific grid tab.                                                                               |
| **Shared**           | Controls whether or not this tab is also visible to players. If there are no shared grids, the players do not see the Screen at all. |
| **Delete**           | Removes a Tab.                                                                                                                       |

## Compatibility

No information for compatibility with other modules is available at this time. The module is compatible with Foundry VTT v13.0.0 and later.

## Known Issues

- The grid does not refresh automatically when settings are changed, click the "refresh" button.
- Some information will appear to players if they are shared a screen that contains things they do not have permission to view normally.
- It is possible to overlap your cells with column/row spanning. It should not be possible to make it so you cannot recover from such a situation manually.

## Acknowledgements

Forked from ElfFriend-DnD's [gm-screen-repository](https://github.com/ElfFriend-DnD/foundryvtt-gmScreen)

Bootstrapped with Nick East's [create-foundry-project](https://gitlab.com/foundry-projects/foundry-pc/create-foundry-project).

Mad props to the [League of Extraordinary FoundryVTT Developers](https://forums.forge-vtt.com/c/package-development/11) community which helped me figure out a lot.

## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="https://github.com/saif-ellafi"><img src="https://avatars.githubusercontent.com/u/27952699?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Saif Addin</b></sub></a><br /><a href="https://github.com/samulopez/foundryvtt-gmScreen/commits?author=saif-ellafi" title="Code">💻</a></td>
    <td align="center"><a href="http://lordzeel.com"><img src="https://avatars.githubusercontent.com/u/1721836?v=4?s=100" width="100px;" alt=""/><br /><sub><b>zeel</b></sub></a><br /><a href="https://github.com/samulopez/foundryvtt-gmScreen/commits?author=zeel01" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/Git-GoR"><img src="https://avatars.githubusercontent.com/u/58085266?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Git-GoR</b></sub></a><br /><a href="#translation-Git-GoR" title="Translation">🌍</a></td>
    <td align="center"><a href="https://github.com/lozalojo"><img src="https://avatars.githubusercontent.com/u/16079668?v=4?s=100" width="100px;" alt=""/><br /><sub><b>José E. Lozano</b></sub></a><br /><a href="#translation-lozalojo" title="Translation">🌍</a></td>
    <td align="center"><a href="https://github.com/CarnVanBeck"><img src="https://avatars.githubusercontent.com/u/1398052?v=4?s=100" width="100px;" alt=""/><br /><sub><b>CarnVanBeck</b></sub></a><br /><a href="#translation-CarnVanBeck" title="Translation">🌍</a></td>
    <td align="center"><a href="https://github.com/DarKDinDoN"><img src="https://avatars.githubusercontent.com/u/1687854?v=4?s=100" width="100px;" alt=""/><br /><sub><b>DarKDinDoN</b></sub></a><br /><a href="https://github.com/samulopez/foundryvtt-gmScreen/commits?author=DarKDinDoN" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/BrotherSharper"><img src="https://avatars.githubusercontent.com/u/41280723?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Brother Sharp</b></sub></a><br /><a href="#translation-BrotherSharper" title="Translation">🌍</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/Shuggaloaf"><img src="https://avatars.githubusercontent.com/u/79543184?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Earl Shuggaloaf</b></sub></a><br /><a href="https://github.com/samulopez/foundryvtt-gmScreen/commits?author=Shuggaloaf" title="Code">💻</a></td>
  </tr>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!
