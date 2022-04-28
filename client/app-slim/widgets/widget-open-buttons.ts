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

  /* Button({ onClick: this.open, ref: 'dropdownButton', className: 'esTopicType_dropdown' },
        pageRole_toIconString(pageRole), ' ', r.span({ className: 'caret' })); */

  const pageLayoutProps = {
    comtOrder: props.page.comtOrder,
    comtNesting: props.page.comtNesting,
  };

  const effLayout = page_effProps(props.page, props.store);

  return (
      Button({ onClick: (event) => {
        const atRect = cloneEventTargetRect(event);
        morebundle.openDiscLayoutDiag({
              atRect, layout: pageLayoutProps, default: effLayout, onSelect: props.onSelect });
      }}, comtOrder_title(effLayout.comtOrder)));
});


export function comtOrder_title(comtOrder: PostSortOrder): St {
  switch (comtOrder) {
    case PostSortOrder.OldestFirst: return "Oldest first";  // I18N here and below
    case PostSortOrder.NewestFirst: return "Newest first";
    case PostSortOrder.BestFirst: return "Best first";
    case PostSortOrder.NewestThenBestFirst: return "Newest then Best first";
  }
  return `Bad: ${comtOrder} TyECMTORDR`;
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
