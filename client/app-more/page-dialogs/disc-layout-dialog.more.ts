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

  let forEveryone: Bo | U;
  let bestFirstItem: RElm | U;
  let oldestFirstItem: RElm | U;
  let newestFirstItem: RElm | U;
  let newestThenBestItem: RElm | U;

  if (isOpen) {
    forEveryone = diagState.forEveryone;
    const makeItem = (comtOrder: PostSortOrder, e2eClass: St): RElm =>
        ExplainingListItem({
            active: layout.comtOrder === comtOrder,
            title: r.span({ className: e2eClass  }, widgets.comtOrder_title(comtOrder)),
            text: comtOrder_descr(comtOrder),
            onSelect: () => {
              diagState.onSelect({ ...layout, comtOrder });
              close();
            } });

    bestFirstItem = makeItem(PostSortOrder.BestFirst, '');
    oldestFirstItem = makeItem(PostSortOrder.OldestFirst, '');
    newestFirstItem = makeItem(PostSortOrder.NewestFirst, '');
    newestThenBestItem = makeItem(PostSortOrder.NewestThenBestFirst, '');
  }

  return (
      DropdownModal({ show: isOpen, onHide: close, atX: atRect.left, atY: atRect.top,
            pullLeft: true, showCloseButton: true },
        r.div({ className: 's_ExplDrp_Ttl' },
          forEveryone ? `Change comments sort order for everyone:`  // I18N
                      : `Sort by:`),
        bestFirstItem,
        oldestFirstItem,
        newestFirstItem,
        newestThenBestItem));
});


export function comtOrder_descr(comtOrder: PostSortOrder): St | N {
  switch (comtOrder) {
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
