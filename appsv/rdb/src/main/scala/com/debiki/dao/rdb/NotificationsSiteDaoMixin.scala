/**
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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

package com.debiki.dao.rdb

import com.debiki.core._
import com.debiki.core.Prelude._
import java.{sql => js, util => ju}
import scala.collection.mutable.ArrayBuffer
import Rdb._
import RdbUtil.makeInListFor


/** Saves and deletes notifications.
  */
trait NotificationsSiteDaoMixin extends SiteTransaction {
  self: RdbSiteTransaction =>


  def saveDeleteNotifications(notifications: Notifications) {
    if (notifications.isEmpty)
      return
    // Perhaps we'd better allow notifications to be created and deleted, so that any
    // site-over-quota notifications get sent.
    notifications.toCreate foreach { createNotf(_) }
    notifications.toDelete foreach { deleteNotf(_) }
  }


  override def nextNotificationId(): NotificationId = {
    val query = """
      select max(notf_id) max_id from notifications3 where site_id = ?
      """
    runQueryFindExactlyOne(query, List(siteId.asAnyRef), rs => {
      val maxId = rs.getInt("max_id") // null becomes 0, fine
      maxId + 1
    })
  }


  private def createNotf(notf: Notification) {
    val sql = """
      insert into notifications3(
        SITE_ID, notf_id, CREATED_AT, NOTF_TYPE,
        UNIQUE_POST_ID, PAGE_ID, ACTION_TYPE, ACTION_SUB_ID,
        BY_USER_ID, TO_USER_ID,
        email_id, email_status, seen_at)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      """


    val values = ArrayBuffer[AnyRef](siteId.asAnyRef, notf.id.asAnyRef, d2ts(notf.createdAt),
      notf.tyype.toInt.asAnyRef)

    notf match {
      case postNotf: Notification.NewPost =>
        values += postNotf.uniquePostId.asAnyRef
        values += NullVarchar // page id not saved because might change if post moved
        values += NullInt // no related post action
        values += NullInt //
        values += postNotf.byUserId.asAnyRef
        values += postNotf.toUserId.asAnyRef
        values += postNotf.emailId.orNullVarchar
        values += postNotf.emailStatus.toInt.asAnyRef  // [306RDLA4]
        values += postNotf.seenAt.orNullTimestamp
    }

    runUpdate(sql, values.toList)
  }


  private def deleteNotf(notfToDelete: NotificationToDelete) {
    import NotificationType._
    val (sql, values: List[AnyRef]) = notfToDelete match {
      case toDelete: NotificationToDelete.ToOneMember =>
        val sql = s"""
          delete from notifications3
          where SITE_ID = ?
            and NOTF_TYPE = ?
            and unique_post_id = ?
            and TO_USER_ID = ?"""
        val values = List(siteId.asAnyRef, toDelete.notfType.toInt.asAnyRef,
              toDelete.uniquePostId.asAnyRef, toDelete.toUserId.asAnyRef)
        (sql, values)
      case postToDelete: NotificationToDelete.NewPostToDelete =>
        val sql = s"""
          delete from notifications3
          where SITE_ID = ?
            and NOTF_TYPE in (
              ${Mention.toInt}, ${DirectReply.toInt}, ${IndirectReply.toInt}, ${
                  NewPost.toInt}, ${PostTagged.toInt}, ${OneLikeVote.toInt})
            and unique_post_id = ?"""
        val values = List(siteId.asAnyRef, postToDelete.uniquePostId.asAnyRef)
        (sql, values)
    }

    runUpdate(sql, values)
  }


  def loadAllNotifications(): Vector[Notification] = {
    val query = s"""
      select * from notifications3
      where site_id = ?
      order by notf_id asc
      """
    val values = List(siteId.asAnyRef)
    runQueryFindMany(query, values, rs => {
      RdbUtil.getNotification(rs)
    })
  }


  def loadNotificationByEmailId(emailId: EmailOutId): Opt[Notf] = {
    val query = s"""
          select * from notifications3
          where site_id = ?
          and email_id = ?
          """
    val values = List(siteId.asAnyRef, emailId)
    runQueryFindOneOrNone(query, values, rs => {
      RdbUtil.getNotification(rs)
    })
  }


  def loadNotificationsToShowInMyMenu(roleId: RoleId, limit: Int, unseenFirst: Boolean,
        skipDeleted: Boolean, upToWhen: Option[ju.Date]): Seq[Notification] = {
    val notfsBySiteId = asSystem.loadNotfsImpl(   // COULD specify consumers
        limit = limit, unseenFirst = unseenFirst, onlyIfEmailVerifiedOrGuest = false,
        Some(siteId), skipReviewTaskNotfs = true, skipDeletedPosts = skipDeleted,
        userIdOpt = Some(roleId), upToWhen = upToWhen)
    // All loaded notifications are to `roleId` only.
    notfsBySiteId(siteId)
  }


  def loadNotificationsAboutPost(postId: PostId, notfType: NotificationType,
          toPpId: Option[UserId]): Seq[Notification] = {
    // E2e tested e.g. here: TyT4AWJL208R
    loadNotificationsAboutPostImpl(postId, notfType, None, toPpId = toPpId)
  }


  private def loadNotificationsAboutPostImpl(postId: PostId, minNotfType: NotificationType,
        maxNotfType: Option[NotificationType], toPpId: Option[UserId])
        : Seq[Notification] = {

    val values = ArrayBuffer[AnyRef](
          siteId.asAnyRef, postId.asAnyRef, minNotfType.toInt.asAnyRef)

    maxNotfType.foreach(notfType => values.append(notfType.toInt.asAnyRef))

    val andToWho = toPpId map { id =>
      values.append(id.asAnyRef)
      "and to_user_id = ?"
    } getOrElse ""

    val query = s"""
      select
        site_id, notf_id, notf_type, created_at,
        unique_post_id, page_id, action_type, action_sub_id,
        by_user_id, to_user_id,
        email_id, email_status, seen_at
      from notifications3
      where site_id = ?
        and unique_post_id = ?
        and ${
          if (maxNotfType.isDefined) "notf_type between ? and ?"
          else "notf_type = ?"
        }
        $andToWho """

    runQueryFindMany(query, values.toList, rs => {
      RdbUtil.getNotification(rs)
    })
  }


  def listUsersNotifiedAboutPost(postId: PostId): Set[UserId] = {
    val query = s"""
      select to_user_id, notf_type
      from notifications3
      where site_id = ?
        and unique_post_id = ?
      """
    runQueryFindManyAsSet(query, List(siteId.asAnyRef, postId.asAnyRef), rs => {
      val userId = rs.getInt("to_user_id")
      val notfTypeInt = rs.getInt("notf_type")
      userId
    })
  }


  def countNotificationsPerUser(): Map[UserId, Int] = {
    val query = s"""
      select to_user_id, count(*) num
      from notifications3
      where site_id = ?
      group by to_user_id
      """
    runQueryBuildMap(query, List(siteId.asAnyRef), rs => {
      val userId = rs.getInt("to_user_id")
      val num = rs.getInt("num")
      userId -> num
    }).withDefaultValue(0)
  }


  def updateNotificationSkipEmail(notifications: Seq[Notification]) {
    updateNotificationConnectToEmail(notifications, email = None)
  }


  def updateNotificationConnectToEmail(notfs: Seq[Notification], email: Opt[Email]) {
    notfs foreach {
      connectNotificationToEmail(_, email)
    }
  }


  def connectNotificationToEmail(notification: Notification, email: Opt[Email]) {
    val statement = i"""
      update notifications3 set email_id = ?, email_status = ?
      where site_id = ? and notf_id = ?
      """

    val emailStatus =
      if (email.isDefined) NotfEmailStatus.Created
      else NotfEmailStatus.Skipped

    val values = List(
      email.map(_.id).orNullVarchar,
      emailStatus.toInt.asAnyRef,
      siteId.asAnyRef,
      notification.id.asAnyRef)

    runUpdate(statement, values)
  }


  def markNotfsAsSeen(userId: UserId, anyNotfId: Option[NotificationId], skipEmails: Boolean) {
    markNotfsAsSeenSkipEmailImpl(userId, anyNotfId = anyNotfId, skipEmails = skipEmails)
  }


  def markNotfsForPostIdsAsSeen(userId: UserId, postIds: Set[PostId], skipEmails: Boolean): Int = {
    markNotfsAsSeenSkipEmailImpl(userId, anyPostIds = Some(postIds), skipEmails = skipEmails)
  }


  private def markNotfsAsSeenSkipEmailImpl(userId: UserId, anyNotfId: Option[NotificationId] = None,
        anyPostIds: Option[Set[PostId]] = None, skipEmails: Boolean): Int = {

    import NotfEmailStatus._

    // Include user id in case someone specified the notf id of another user's notification.
    val values = ArrayBuffer[AnyRef](siteId.asAnyRef, userId.asAnyRef)
    val differentTests = anyNotfId.map({ notfId =>
      TESTS_MISSING
      values.append(notfId.asAnyRef)
      "notf_id = ?"
    }).orElse(anyPostIds.map({ postIds =>
      if (postIds.isEmpty)
        return 0
      // Tested here:  notfs-mark-seen-as-seen  TyT2AKBR0T
      values.appendAll(postIds.map(_.asAnyRef))
      s"unique_post_id in (${ makeInListFor(postIds) })"
    })).getOrElse({
      // This marks all one's notf as read. Tested here: [TyT4KA2PU6]
      "true"
    })

    COULD_OPTIMIZE; EDIT_INDEX // and simplify: change this index:
    // "dw1_ntfs_seen_createdat__i" btree ((
    //   case
    //     when seen_at is null then created_at + '100 years'::interval
    //   else created_at
    //   end) desc)
    // to two indexes: one for  seen_at-is-null, and another where not-null,
    // both sorted by created_at desc.
    // And do two queries, to list notfs.
    // That's simpler to understand than this  case-when-then — when will that index get used ??

    val (commaChangeEmailStatusFromUndecidedToSkipped, orEmailStatusUndecided) =
      if (!skipEmails) {
        // This `[notf-email-if-active]
        ("", "")
      }
      else {
        (i""" ,
          email_status =
            case
              when email_status = ${Undecided.toInt} then ${Skipped.toInt}
              else email_status
            end
          """,
          s"or email_status = ${Undecided.toInt}")
    }

    val statement = i"""
      update notifications3 set
        seen_at =
          case
            when seen_at is null then now_utc()
            else seen_at
          end
        $commaChangeEmailStatusFromUndecidedToSkipped
      where site_id = ?
        and to_user_id = ?
        and (seen_at is null $orEmailStatusUndecided)
        and ($differentTests)
      """
    runUpdate(statement, values.toList)
  }

}

