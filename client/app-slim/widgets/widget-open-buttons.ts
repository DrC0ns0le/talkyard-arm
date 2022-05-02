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

/// <reference path="../more-bundle-not-yet-loaded.ts" />
// xx <reference path="../utils/react-utils.ts" />


// Buttons that open lazy loaded dialogs.
//
//------------------------------------------------------------------------------
   namespace debiki2.widgets {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;



export const DiscLayoutDropdownBtn = React.createFactory<DiscLayoutDropdownBtnProps>(
        function(props: DiscLayoutDropdownBtnProps) {
    /*
  const layout = {
    comtOrder: props.page.comtOrder,
    comtNesting: props.page.comtNesting,
  };

  const defaultLayout = page_deriveDiscProps(props.page, props.store, props.layoutFor);
  */

  // If we're A) altering the page layout, e.g. the comments sort order,
  // but not saving server side, then,
  // layoutFor === PageWithTweaks, and the default layout would be the page *without*
  // tweaks, that is,  PageNoTweaks = PageWithTweaks + 1.
  // And if we're B) saving server side, then,
  // layoutFor === PageNoTweaks, and the defaults would be the category layout props
  // (if the page didn't have its own), that is,  LayoutFor.Ancestors = PageNoTweaks + 1.
  // So, the "parent" layout is +1:
  const layoutForParent = props.layoutFor + 1;

  const layout        = page_deriveDiscProps(props.page, props.store, props.layoutFor);
  const defaultLayout = page_deriveDiscProps(props.page, props.store, layoutForParent);

  return (
      Button({ className: 'esTopicType_dropdown', onClick: (event) => {
          const atRect = cloneEventTargetRect(event);
          morebundle.openDiscLayoutDiag({
              atRect, layout, default: defaultLayout,
              forEveryone: props.forEveryone, onSelect: props.onSelect });
        }},
        comtOrder_title(layout.comtOrder), ' ', r.span({ className: 'caret' })));
});


export function comtOrder_title(comtOrder: PostSortOrder): St {
  switch (comtOrder) {
    case PostSortOrder.OldestFirst: return "Oldest first";  // I18N here and below
    case PostSortOrder.NewestFirst: return "Newest first";
    case PostSortOrder.BestFirst: return "Popular first";
    case PostSortOrder.NewestThenBestFirst: return "Newest then Popular";
  }
  return `Bad: ${comtOrder} TyECMTORDR`;
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
