const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.notifyOnNewMessage = functions.firestore
  .document('messages/{threadId}/items/{itemId}')
  .onCreate(async (snap, context) => {
    const msg = snap.data();
    const threadDoc = await admin.firestore().doc(`messages/${context.params.threadId}`).get();
    const thread = threadDoc.data() || {};
    const receiverUid = thread.participants?.find(u => u !== msg.from);
    if (!receiverUid) return;

    const tokensSnap = await admin.firestore()
      .collection('fcmTokens')
      .where('uid', '==', receiverUid)
      .where('active', '==', true)
      .get();

    const tokens = tokensSnap.docs.map(d => d.id);
    if (!tokens.length) return;

    await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title: thread.otherName || 'Yeni mesaj',
        body: msg.text || '',
      },
      data: {
        threadId: context.params.threadId,
        from: msg.from || '',
      },
      webpush: {
        fcmOptions: { link: `/mesajlar.html?peer=${receiverUid}` }
      }
    });
  });
