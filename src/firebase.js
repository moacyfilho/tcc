import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAq4mGLIY1VbNH0S4yfW-xICb3LO9ANJ10",
  authDomain: "tcc1-45c2c.firebaseapp.com",
  projectId: "tcc1-45c2c",
  storageBucket: "tcc1-45c2c.firebasestorage.app",
  messagingSenderId: "1004816612133",
  appId: "1:1004816612133:web:53932b772dba2ca56c38cc",
  measurementId: "G-BYSP4LZ318"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;
