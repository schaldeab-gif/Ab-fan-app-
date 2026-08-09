import firebase from 'firebase';
import 'firebase/auth';
import 'firebase/firestore';
import 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDmJg03qTzHi8Y3eS70F5nt-0m8ZA08efM",
  authDomain: "ab-fan.firebaseapp.com",
  projectId: "ab-fan",
  storageBucket: "ab-fan.firebasestorage.app",
  messagingSenderId: "245015635755",
  appId: "1:245015635755:web:8d827bcb89c0e744c7c76e"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const auth = firebase.auth();
export const db = firebase.firestore();
export const storage = firebase.storage();
export default firebase;
