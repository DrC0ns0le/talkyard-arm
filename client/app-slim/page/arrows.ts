/*
 * Copyright (c) 2014 Kaj Magnus Lindberg
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

/*
 * This file draws arrows between comments to illustrate parent child relationships.
 * It draws PNG arrows.
 *
 * There is old outdated jQuery soup code that draws arrows in SVG, here:
 *   client/app/old/arrows/arrows-svg-unused.js
 * There are problems with SVG though: rendering SVG arrows takes rather long,
 * especially problematic on mobile phones. And keeping the SVG arrows correctly stretched
 * when something is resized, is prone to errors. (The PNG arrows use `border: ...` and
 * resize automatically.) Also, I haven't yet made SVG avoid indenting deeply nested
 * replies "too much".
 */

/// <reference path="../prelude.ts" />
/// <reference path="../ReactActions.ts" />
/// <reference path="../utils/scroll-into-view.ts" />
/// <reference path="../page/scroll-buttons.ts" />


//------------------------------------------------------------------------------
  namespace debiki2.renderer {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;


export function drawHorizontalArrowFromRootPost(rootPost) {
  var arrowToChildren;
  if (rootPost.childNrsSorted.length === 1) {
    arrowToChildren = r.div({ className: 'dw-arw dw-arw-hz-curve-to-reply-btn' });
  }
  else if (rootPost.childNrsSorted.length >= 2) {
    arrowToChildren = r.div({ className: 'dw-arw dw-arw-hz-branch-to-reply-btn' });
  }
  return r.div({ className: 'dw-t-vspace' }, arrowToChildren);
}


export function drawArrowsFromParent(
      postsByNr: { [postNr: number]: Post; }, parentPost: Post, depth: number,
      index: number, horizontalLayout: boolean, rootPostNr: number,
      // COULD REFACTOR: don't send both horizontalLayout and hmmIs2dTreeColumn.
      hmmIs2dTreeColumn: boolean) {

  // Some posts have no parent, e.g. form replies and embedded comments.
  if (!parentPost)
    return [];

  var postNr = parentPost.childNrsSorted[index];
  var post: Post = postsByNr[postNr];
  if (!post)
    return []; // deleted

  var isSquashing = post.squash;

  // Find out how many siblings after `index` to which we shall draw arrows.
  var numRemainingWithArrows = 0;
  if (parentPost) {
    for (var i = index + 1; i < parentPost.childNrsSorted.length; ++i) {
      var siblingNr = parentPost.childNrsSorted[i];
      var sibling: Post = postsByNr[siblingNr];
      if (!sibling) {
        // This post has been deleted?
        continue;
      }
      if (isSquashing && sibling.squash) {
        // Don't break — there might be non-squashed siblings later.
        continue;
      }
      if (sibling.squash) {
        // Don't increase numRemainingWithArrows with more than 1 for a bunch of squashed siblings.
        isSquashing = true;
      }
      if (sibling.multireplyPostNrs.length) {
        break;
      }
      numRemainingWithArrows += 1;
    }
  }

  if (hmmIs2dTreeColumn) {
    return drawHorizontalArrows(index === 0, numRemainingWithArrows);
  }

  if (parentPost && horizontalLayout && parentPost.nr === rootPostNr) {
    return drawHorizontalArrows(index === 0, numRemainingWithArrows);
  }

  if (parentPost) {
    // In vertical layout, don't draw arrows to top level replies.
    if (!horizontalLayout && depth === 1)
      return [];

    return drawVerticalArrows(depth, index === 0, horizontalLayout, numRemainingWithArrows,
        parentPost);
  }

  return [];
}


function drawHorizontalArrows(isFirstChild: boolean, numRemainingWithArrows: number) {
  // We're rendering a top level reply in its own column. Draw horizontal arrows from
  // the root post. First, and arrow to this thread. Then, if there are any sibling
  // therad columns to the right, arrows to them too. But if this thread is the very
  // first child, then skip some arrows because there's already a special arrow
  // from the root post to this thread.
  var arrows = [];

  if (!isFirstChild) {
    arrows.push(
        r.div({ className: 'dw-arw dw-arw-hz-curve-to-this', key: 11 }));
  }

  if (numRemainingWithArrows > 0) {
    if (!isFirstChild) {
      arrows.push(
         r.div({ className: 'dw-arw dw-arw-hz-line-to-this', key: 12 }));
    }
    arrows.push(
        r.div({ className: 'dw-arw dw-arw-hz-line-to-sibling', key: 13 }));
  }

  return arrows;
}


function drawVerticalArrows(depth: number, isFirstChild: boolean,
    horizontalLayout: boolean, numRemainingWithArrows: number, parentPost: Post) {

  var arrows = [];

  if (isFirstChild) {
    // This arrrow is shown if the max indentation depth is reached. Then
    // we'll still draw an arrow from the parent to this post, if this post is
    // the very first child (and this post won't be indented, so we'll hide
    // all arrows to any siblings).
    arrows.push(
      r.div({ className: 'dw-arw dw-arw-vt-curve-to-this-first-unindented', key: 21 }));
  }

  // Only one reply
  // ------------------
  //
  // Single replies (without any siblings) are placed directly below their parent,
  // as if using a flat layout (rather than a threaded layout). Then, need draw
  // no arrows; people are used to flat layouts.
  //
  // This is how it looks:
  //
  // Explanation                                 Illustration
  // -----------                                 ------------
  //
  // A parent comment with only one reply.       +-----—-———————----+
  //                                             |parent comment    |
  //                                             |text…             |
  //                                             +------------------+
  //                                              ＼
  //                                               v
  // The child comment (would be this post,      +-----—------------+
  // if `isOnlyChild` below is true).            |the only child    |
  //                                             |comment text…     |
  //                                             +------------------+

  var isOnlyChild = isFirstChild && numRemainingWithArrows === 0;
  if (isOnlyChild) {
    arrows.push(
      r.div({ className: 'dw-arw dw-arw-vt-curve-to-this', key: 22 }));
    return arrows;
  }

  // Many replies
  // ------------------
  //
  // Let me explain how I draw arrows to this thread from the parent:
  //
  //
  // Explanation                                 Illustration
  // -----------                                 ------------
  //
  // A parent comment with 3 replies.            +-----—-———————----+
  //                                             |parent comment    |
  //                                             |text…             |
  //                                         __  +------------------+
  // This part >--------->---------->-------/    |
  // is "dw-arw-vt-line-to-sibling-1"       \    |
  //                                         \_  |
  // This line >----------->------->----->   /   |`-> +-----—-------+
  // is "dw-arw-vt-curve-to-this"           /    |    |child comment|
  //                                       /     |    |text…        |
  // This part >---------->-------->------/----  |    +-------------+
  // is "dw-arw-vt-line-to-sibling-2"       /    |
  //                                       /     |
  // And here is >---------->-------->----/----  |`-> +-----------—-+
  // is "dw-arw-vt-line-to-sibling-1",           |    |child comment|
  // again.                                      |    |text…        |
  //                                             |    +-------------+
  //                                             ＼
  // This very last line to the :last-child -->   v
  // is "dw-arw-vt-curve-to-unindented".         +-----—------------+
  // Here, numRemainingWithArrows is 0.          |:last-child       |
  //                                             |comment text…     |
  //                                             +------------------+

  // Draw the `-> part:
  if (numRemainingWithArrows >= 1) {
    arrows.push(
        r.div({ className: 'dw-arw dw-arw-vt-curve-to-this', key: 23 }));
  }

  // Start or continue an arrow to the siblings below, but not to
  // multireplies, since we don't know if they reply to the current post,
  // or to posts elsewhere in the tree.
  if (numRemainingWithArrows >= 1) {
    arrows.push(
        r.div({ className: 'dw-arw dw-arw-vt-line-to-sibling-1', key: 24 }));
    arrows.push(
        r.div({ className: 'dw-arw dw-arw-vt-line-to-sibling-2', key: 25 }));

    //          ＼
    // Draw the  v  arrow to the very last sibling: — ... but always indent it, nowadays. [6UWADTW0]
    if (numRemainingWithArrows === 1) {
      //if (!horizontalLayout && depth === 2) {
        arrows.push(
          r.div({ className: 'dw-arw dw-arw-vt-curve-to-last-sibling-indented', key: 26 }));
      /*}
      else {
        arrows.push(
          r.div({ className: 'dw-arw dw-arw-vt-curve-to-last-sibling-unindented', key: 27 }));
      }*/
    }

    // Add a clickable handle that scrolls to the parent post and highlights it.
    arrows.push(
        r.div({ className: 'dw-arw-vt-handle', key: 28, onMouseDown: rememberMousedownCoords,
              onClick: (event) => scrollToParent(event, parentPost),
              onMouseEnter: (event) => highlightArrowIfParentPostNotVisible(event, parentPost),
              onMouseLeave: (event) => highlightArrowIfParentPostNotVisible(event, parentPost) }));
  }

  return arrows;
}


let arrowHandleMousedownCoords = null;

function rememberMousedownCoords(event) {
  arrowHandleMousedownCoords = {
    clientX: event.clientX,
    clientY: event.clientY
  };
}

function scrollToParent(event, parentPost: Post) {
  if (arrowHandleMousedownCoords) {
    const dragDistanceX = event.clientX - arrowHandleMousedownCoords.clientX;
    const dragDistanceY = event.clientY - arrowHandleMousedownCoords.clientY;
    const dragDistance2 = dragDistanceX * dragDistanceX + dragDistanceY * dragDistanceY;
    if (dragDistance2 > 15) {
      // This is click-and-drag, probably Utterscrolling, not a pure click.
      return;
    }
  }
  const parentPostElem = $byId('post-' + parentPost.nr);
  if (!utils.elemIsVisible(parentPostElem)) {
    debiki2.page.addVisitedPositionAndPost(parentPost.nr);
  }

  // (UX: Always highlight the post, even if it's on screen already, because otherwise
  // some people who test-click the arrows after having watched the click-arrows demo video,
  // think the arrows are broken. loadAndShowPost always highlights it.)
  ReactActions.loadAndShowPost(parentPost.nr);
}


// Highlighs an arrow on hover, if the parent post is not visible, because then
// clicking the arrow scrolls the parent into view. (Otherwise don't highlight
// though, because that'd be annoying.)
function highlightArrowIfParentPostNotVisible(event, parentPost: Post) {
  const arrowElem = event.target;
  const parentPostElem = $byId('post-' + parentPost.nr);
  const parentVisible = debiki.internal.elemIsVisible(parentPostElem);
  const siblingRepliesRoot = arrowElem.parentNode.parentNode;
  const siblingThreads = siblingRepliesRoot.children;
  _.each(siblingThreads, function(threadElem) {
    const arrowHandleElem = threadElem.querySelector('.dw-arw-vt-handle');
    if (!arrowHandleElem || arrowHandleElem.parentNode != threadElem) return;
    if (event.type === 'mouseenter' || event.type === 'mouseover') {
      if (!parentVisible) {
        $h.addClasses(arrowHandleElem, 'dw-highlight');
        arrowHandleElem.style.cursor = 'pointer';
      }
      else {
        arrowHandleElem.style.cursor = 'default';
      }
    }
    else {
      $h.removeClasses(arrowHandleElem, 'dw-highlight');
    }
  });
}

//------------------------------------------------------------------------------
  }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
