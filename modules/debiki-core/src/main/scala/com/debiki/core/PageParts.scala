/**
 * Copyright (C) 2015 Kaj Magnus Lindberg
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

package com.debiki.core

import java.{util => ju}
import scala.collection.mutable.ArrayBuffer
import scala.collection.{immutable, mutable}
import Prelude._
import PageParts._


object PageParts {


  // Letting the page body / original post be number 1 is compatible with Discourse.
  val TitleNr = 0
  val BodyNr = 1  // (could rename to OrigPostId)
  val FirstReplyNr = 2

  val LowestPostNr = TitleNr
  assert(LowestPostNr == 0)

  val NoNr = -1

  val MaxTitleLength = 150

  def isArticleOrConfigPostNr(nr: PostNr) =
    nr == PageParts.BodyNr || nr == PageParts.TitleNr


  def isReply(postNr: PostNr) = postNr >= FirstReplyNr


  /** Finds the 0 to 3 most frequent posters.
    * Would: If two users have both posted X posts, then, among them, pick the most recent poster?
    */
  def findFrequentPosters(posts: Seq[Post], ignoreIds: Set[UserId]): Seq[UserId] = {
    val numPostsByUserId = mutable.HashMap[UserId, Int]().withDefaultValue(0)
    for (post <- posts if !ignoreIds.contains(post.createdById)) {
      val numPosts = numPostsByUserId(post.createdById)
      numPostsByUserId(post.createdById) = numPosts + 1
    }
    val userIdsAndNumPostsSortedDesc =
      numPostsByUserId.toSeq.sortBy(userIdAndNumPosts => userIdAndNumPosts._2)
    userIdsAndNumPostsSortedDesc.take(3).map(_._1)
  }

}



/** The parts of a page are 1) posts: any title post, any body post, and any comments,
  * and 2) people, namely those who have authored or edited the posts.
  *
  * Should be immutable. If backed by the database, a serializable isolation level
  * transaction should be used.
  *
  * TODO move to debiki-server instead?
  */
abstract class PageParts extends People {

  private lazy val postsByNr: collection.Map[PostNr, Post] = {
    val postsMap = mutable.HashMap[PostNr, Post]()
    for (post <- allPosts) {
      postsMap.put(post.nr, post)
    }
    postsMap
  }

  private lazy val childrenBestFirstByParentNr: collection.Map[PostNr, immutable.Seq[Post]] = {
    // COULD find out how to specify the capacity?
    val childMap = mutable.HashMap[PostNr, Vector[Post]]()
    for (post <- allPosts) {
      val parentNrOrNoNr = post.parentNr getOrElse PageParts.NoNr
      var siblings = childMap.getOrElse(parentNrOrNoNr, Vector[Post]())
      siblings = siblings :+ post
      childMap.put(parentNrOrNoNr, siblings)
    }
    childMap.mapValues(Post.sortPostsBestFirst)
  }

  def highestReplyNr: Option[PostNr] = {
    if (allPosts.isEmpty)
      return None
    val maxNr = allPosts.map(_.nr).max
    if (PageParts.isArticleOrConfigPostNr(maxNr)) None
    else Some(maxNr)
  }

  def pageId: PageId
  def titlePost: Option[Post] = post(PageParts.TitleNr)

  def topLevelComments: immutable.Seq[Post] =
    childrenBestFirstByParentNr.getOrElse(PageParts.NoNr, Nil) filterNot { post =>
      PageParts.isArticleOrConfigPostNr(post.nr)
    }

  def allPosts: Seq[Post]

  def post(postNr: PostNr): Option[Post] = postsByNr.get(postNr)
  def post(postNr: Option[PostNr]): Option[Post] = postNr.flatMap(postsByNr.get)
  def thePost(postNr: PostNr): Post = post(postNr) getOrDie "DwE9PKG3"


  def numRepliesTotal = allPosts.count(_.isReply)
  lazy val numRepliesVisible = allPosts count { post =>
    post.isReply && post.isVisible
  }

  lazy val numOrigPostRepliesVisible = allPosts count { post =>
    post.isOrigPostReply && post.isVisible
  }


  def theUser(userId: UserId): User


  /** Returns the index of `post` among its siblings, the first sibling is no 0.
    * Also tells if there are any non-deleted trees afterwards.
    */
  def siblingIndexOf(post: Post): (Int, Boolean) = post.parentNr match {
    case None => (0, false)
    case Some(parentNr) =>
      val siblings = childrenBestFirstOf(parentNr)
      var index = 0
      var result = -1
      while (index < siblings.length) {
        val sibling = siblings(index)
        if (sibling.nr == post.nr) {
          dieIf(result != -1, "DwE4JPU7")
          result = index
        }
        else if (result != -1) {
          if (!sibling.isDeleted || hasNonDeletedSuccessor(sibling.nr))
            return (result, true)
        }
        index += 1
      }
      (result, false)
  }


  def childrenBestFirstOf(postNr: PostNr): immutable.Seq[Post] =
    childrenBestFirstByParentNr.getOrElse(postNr, Nil)


  def successorsOf(postNr: PostNr): immutable.Seq[Post] = {
    val pending = ArrayBuffer[Post](childrenBestFirstByParentNr.getOrElse(postNr, Nil): _*)
    val successors = ArrayBuffer[Post]()
    while (pending.nonEmpty) {
      val next = pending.remove(0)
      if (successors.find(_.nr == next.nr).nonEmpty) {
        die("DwE9FKW3", s"Cycle detected on page '$pageId'; it includes post '${next.nr}'")
      }
      successors.append(next)
      pending.append(childrenBestFirstOf(next.nr): _*)
    }
    successors.toVector
  }


  def hasNonDeletedSuccessor(postNr: PostNr): Boolean = {
    // COULD optimize this, bad O(?) complexity when called on each node, like
    // ReactJson.pageToJsonImpl does — O(n*n)? Could start at the leaves and work up instead
    // and cache the result -> O(n).
    childrenBestFirstOf(postNr) exists { child =>
      !child.deletedStatus.isDeleted || hasNonDeletedSuccessor(child.nr)
    }
  }


  def parentOf(postNr: PostNr): Option[Post] =
    thePost(postNr).parentNr.map(id => thePost(id))


  def depthOf(postNr: PostNr): Int =
    ancestorsOf(postNr).length


  /** Ancestors, starting with postId's parent. */
  def ancestorsOf(postNr: PostNr): List[Post] = {
    var ancestors: List[Post] = Nil
    var curPost: Option[Post] = Some(thePost(postNr))
    while ({
      curPost = parentOf(curPost.get.nr)
      curPost.nonEmpty
    }) {
      ancestors ::= curPost.get
    }
    ancestors.reverse
  }


  def findCommonAncestorNr(postNrs: Seq[PostNr]): PostNr = {
    TESTS_MISSING // COULD check for cycles?
    if (postNrs.isEmpty || postNrs.contains(PageParts.NoNr))
      return PageParts.NoNr

    val firstPost = thePost(postNrs.head)
    var commonAncestorNrs: Seq[PostNr] = firstPost.nr :: ancestorsOf(firstPost.nr).map(_.nr)
    for (nextPostNr <- postNrs.tail) {
      val nextPost = thePost(nextPostNr)
      var ancestorNrs = nextPost.nr :: ancestorsOf(nextPost.nr).map(_.nr)
      var commonAncestorFound = false
      while (ancestorNrs.nonEmpty && !commonAncestorFound) {
        val nextAncestorNr = ancestorNrs.head
        if (commonAncestorNrs.contains(nextAncestorNr)) {
          commonAncestorNrs = commonAncestorNrs.dropWhile(_ != nextAncestorNr)
          commonAncestorFound = true
        }
        else {
          ancestorNrs = ancestorNrs.tail
        }
      }
      if (ancestorNrs.isEmpty)
        return NoNr
    }
    commonAncestorNrs.head
  }

}
