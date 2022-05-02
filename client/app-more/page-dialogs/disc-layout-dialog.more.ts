/*
 * Copyright (c) 2022 Kaj Magnus Lindberg
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/// <reference path="../more-prelude.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.pagedialogs {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const DropdownModal = utils.DropdownModal;
const ExplainingListItem = util.ExplainingListItem;


let dialogSetState: (_: DiscLayoutDiagState) => Vo;

export function openDiscLayoutDiag(ps: DiscLayoutDiagState) {
  if (!dialogSetState) {
    ReactDOM.render(DiscLayoutDiag(), utils.makeMountNode());  // or [use_portal] ?
  }
  dialogSetState(ps);
}


/// Some dupl code? [6KUW24]  but this with React hooks.
///
const DiscLayoutDiag = React.createFactory<{}>(function() {
  //displayName: 'DiscLayoutDiag',

  const [diagState, setDiagState] =
        React.useState<DiscLayoutDiagState | N>(null);

  dialogSetState = setDiagState;

  const layout: DiscPropsSource | U = diagState && diagState.layout;
  const atRect: Rect = (diagState?.atRect || {}) as Rect;
  const isOpen = !!layout;

  function close() {
    setDiagState(null);
  }

  let forCat: Bo | U;
  let forEveryone: Bo | U;
  let defaultItem: RElm | U;
  let bestFirstItem: RElm | U;
  let oldestFirstItem: RElm | U;
  let newestFirstItem: RElm | U;
  let newestThenBestItem: RElm | U;

  if (isOpen) {
    forCat = diagState.forCat;
    forEveryone = diagState.forEveryone;
    const makeItem = (comtOrder: PostSortOrder, e2eClass: St, isDefault?: true): RElm =>
        ExplainingListItem({
            active: layout.comtOrder === comtOrder || !layout.comtOrder && isDefault,
            title: r.span({ className: e2eClass  },
              (isDefault ? "Default: " : ''),
              widgets.comtOrder_title(comtOrder)),
            text: comtOrder_descr(comtOrder, forCat),
            onSelect: () => {
              diagState.onSelect({ ...layout, comtOrder });
              close();
            } });

    defaultItem = makeItem(diagState.default.comtOrder, '', true);
    bestFirstItem = makeItem(PostSortOrder.BestFirst, '');
    oldestFirstItem = makeItem(PostSortOrder.OldestFirst, '');
    newestFirstItem = makeItem(PostSortOrder.NewestFirst, '');
    newestThenBestItem = makeItem(PostSortOrder.NewestThenBestFirst, '');
  }

  return (
      DropdownModal({ show: isOpen, onHide: close, atX: atRect.left, atY: atRect.top,
            pullLeft: true, showCloseButton: true },
        r.div({ className: 's_ExplDrp_Ttl' },
          forCat
              ? // Should be obvious that this is for everyone, since everything else
                // in the category edit dialog affects everyone.
                `Comments sort order, in this category:` // 0I18N, is for staff
              : (
                // But when changing sort order, on a specific page, then,
                // one button is for everyone — the Change... page button.
                // And another is for oneself only. Therefore, good with
                // different dialog titles:
                forEveryone ? `Change comments sort order for everyone:`
                              : `Sort by:`)),
        defaultItem,
        bestFirstItem,
        oldestFirstItem,
        newestFirstItem,
        newestThenBestItem));
});


function comtOrder_descr(comtOrder: PostSortOrder, forCat: Bo): St | N {
  // 0I18N here; this is for staff.
  switch (comtOrder) {
    case PostSortOrder.Default:
      return forCat ? "The default, in this category" : null;
    case PostSortOrder.NewestThenBestFirst:
      return "Replies to the Original Post are sorted by newest-first, " +
          "and replies to the replies by popular-first. This can be nice " +
          "if you post status updates as comments — the most recent update, " +
          "appears at the top, with replies sorted popular-first.";
    default: return null;
  }
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
