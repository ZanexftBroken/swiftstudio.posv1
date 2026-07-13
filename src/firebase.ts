import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC53tnpw-3Uupzc1Me8ZGEDzy903yG-S0Y", 
  authDomain: "ascedia-60dd4.firebaseapp.com", 
  databaseURL: "https://ascedia-60dd4-default-rtdb.asia-southeast1.firebasedatabase.app", 
  projectId: "ascedia-60dd4"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
