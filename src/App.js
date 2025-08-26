import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, setLogLevel } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { Plus, Trash2, X, Lightbulb, BarChart2, Target } from 'lucide-react';

// --- Main App Component ---
export default function App() {
  // --- State Management ---
  const [subjects, setSubjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userId, setUserId] = useState(null);
  const [db, setDb] = useState(null);

  // State for the "Add Subject" modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectType, setNewSubjectType] = useState('Lecture');

  // State for AI Advisor
  const [targetAdvicePercentage, setTargetAdvicePercentage] = useState(75);
  const [futureCommitments, setFutureCommitments] = useState('');
  const [advice, setAdvice] = useState('');


  // --- Firebase Initialization ---
  useEffect(() => {
    try {
const firebaseConfig = {
  apiKey: process.env.REACT_APP_API_KEY,
  authDomain: process.env.REACT_APP_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_PROJECT_ID,
  storageBucket: process.env.REACT_APP_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_APP_ID
};


      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const auth = getAuth(app);
      setDb(firestore);

      onAuthStateChanged(auth, user => {
        if (user) setUserId(user.uid);
        else signInAnonymously(auth).catch(err => setError("Authentication failed."));
      });
    } catch (e) {
      setError("Failed to initialize Firebase. Please provide your config in App.js.");
      setIsLoading(false);
    }
  }, []);

  // --- Data Fetching (Real-time) ---
  useEffect(() => {
    if (!userId || !db) return;
    setIsLoading(true);
    const unsubscribe = onSnapshot(collection(db, `users/${userId}/subjects`),
      (snapshot) => {
        const subjectsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setSubjects(subjectsData.sort((a, b) => a.name.localeCompare(b.name)));
        setIsLoading(false);
      },
      (err) => {
        setError("Failed to load data. Check Firestore rules.");
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, [userId, db]);

  // --- Calculations ---
  const calculatePercentage = (present, conducted) => {
    if (!conducted) return 0;
    return (present / conducted) * 100;
  };

  const calculateProjection = (present, conducted, target) => {
    const targetDecimal = target / 100;
    if (conducted > 0 && (present / conducted) >= targetDecimal) return 0;
    const needed = Math.ceil((targetDecimal * conducted - present) / (1 - targetDecimal));
    return needed > 0 ? needed : 0;
  };

  const summary = useMemo(() => {
    const totalConducted = subjects.reduce((sum, s) => sum + (s.conducted || 0), 0);
    const totalPresent = subjects.reduce((sum, s) => sum + (s.present || 0), 0);
    const overallPercentage = calculatePercentage(totalPresent, totalConducted);
    return { totalConducted, totalPresent, overallPercentage };
  }, [subjects]);

  // --- Database Operations ---
  const handleAddSubject = async (e) => {
    e.preventDefault();
    if (!newSubjectName.trim() || !userId || !db) return;
    try {
      await addDoc(collection(db, `users/${userId}/subjects`), {
        name: newSubjectName.trim(),
        type: newSubjectType.trim(),
        conducted: 0,
        present: 0,
      });
      setNewSubjectName('');
      setNewSubjectType('Lecture');
      setIsModalOpen(false);
    } catch (err) { setError("Could not add subject."); }
  };

  const handleUpdateSubject = async (id, field, value) => {
    if (!userId || !db) return;
    const numericValue = parseInt(value, 10);
    if (isNaN(numericValue) || numericValue < 0) return;
    try {
      await updateDoc(doc(db, `users/${userId}/subjects`, id), { [field]: numericValue });
    } catch (err) { setError("Could not update subject."); }
  };

  const handleDeleteSubject = async (id) => {
    if (!userId || !db) return;
    if (window.confirm("Are you sure you want to delete this subject?")) {
      try {
        await deleteDoc(doc(db, `users/${userId}/subjects`, id));
      } catch (err) { setError("Could not delete subject."); }
    }
  };
  
  // --- AI Advisor Logic ---
  const handleGetAdvice = () => {
      const { totalPresent, totalConducted, overallPercentage } = summary;
      const needed = calculateProjection(totalPresent, totalConducted, targetAdvicePercentage);

      let adviceMessage = `Your current overall attendance is ${overallPercentage.toFixed(2)}%. `;
      if (overallPercentage >= targetAdvicePercentage) {
          adviceMessage += `Great job! You've met your ${targetAdvicePercentage}% target. Keep up the consistent effort.`;
      } else {
          adviceMessage += `To reach your ${targetAdvicePercentage}% goal, you need to attend the next ${needed} classes without fail. `;
      }

      if (futureCommitments.trim()) {
          adviceMessage += `\nRemember to account for your upcoming commitment: "${futureCommitments}". This might require extra focus on other classes to maintain your percentage.`;
      } else {
          adviceMessage += `\nPrioritize your upcoming classes and plan your schedule to avoid any unnecessary absences.`
      }
      setAdvice(adviceMessage);
  };


  return (
    <div className="bg-slate-900 text-slate-300 min-h-screen font-sans">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8">

        {/* Header */}
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-white tracking-tight">Vimarshaha's Attendance</h1>
          <p className="text-slate-400 mt-1">Your personal attendance management and advisory dashboard.</p>
        </header>
        
        {error && <div className="bg-red-500/20 text-red-300 p-3 rounded-lg mb-6">{error}</div>}

        <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Content: Attendance Data */}
          <section className="lg:col-span-2">
            <div className="bg-slate-800/50 p-6 rounded-lg shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-white">Attendance Data</h2>
                  <p className="text-sm text-slate-400">Manage your subject attendance here. Changes are saved automatically.</p>
                </div>
                <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-indigo-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-indigo-700 transition-all duration-200">
                  <Plus size={18} />
                  Add Subject
                </button>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="border-b border-slate-700 text-xs text-slate-400 uppercase">
                    <tr>
                      <th className="p-3">Subject Name</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Conducted</th>
                      <th className="p-3">Present</th>
                      <th className="p-3">Absent</th>
                      <th className="p-3">Percentage</th>
                      <th className="p-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr><td colSpan="7" className="text-center p-4">Loading...</td></tr>
                    ) : subjects.length === 0 ? (
                       <tr><td colSpan="7" className="text-center p-4 text-slate-500">No subjects added yet.</td></tr>
                    ) : (
                      subjects.map(s => {
                        const percentage = calculatePercentage(s.present, s.conducted);
                        const absent = s.conducted - s.present;
                        return (
                          <tr key={s.id} className="border-b border-slate-800 hover:bg-slate-800/40">
                            <td className="p-3 font-medium text-white capitalize">{s.name}</td>
                            <td className="p-3 capitalize">{s.type}</td>
                            <td><input type="number" value={s.conducted} onChange={(e) => handleUpdateSubject(s.id, 'conducted', e.target.value)} className="w-16 bg-slate-700/50 p-1.5 rounded-md text-center"/></td>
                            <td><input type="number" value={s.present} onChange={(e) => handleUpdateSubject(s.id, 'present', e.target.value)} className="w-16 bg-slate-700/50 p-1.5 rounded-md text-center"/></td>
                            <td className="p-3 text-red-400 font-medium">{absent < 0 ? 0 : absent}</td>
                            <td className={`p-3 font-bold ${percentage >= 75 ? 'text-green-400' : 'text-amber-400'}`}>{percentage.toFixed(1)}%</td>
                            <td className="p-3 text-center"><button onClick={() => handleDeleteSubject(s.id)} className="text-slate-500 hover:text-red-500"><Trash2 size={16} /></button></td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot>
                     <tr className="font-bold text-white bg-slate-700/50">
                        <td className="p-3" colSpan="4">Overall</td>
                        <td className="p-3">{summary.totalConducted - summary.totalPresent}</td>
                        <td className={`p-3 ${summary.overallPercentage >= 75 ? 'text-green-400' : 'text-amber-400'}`}>{summary.overallPercentage.toFixed(1)}%</td>
                        <td></td>
                     </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </section>

          {/* Sidebar Content */}
          <aside className="space-y-8">
            {/* Attendance Projections */}
            <div className="bg-slate-800/50 p-6 rounded-lg shadow-lg">
               <div className="flex items-center gap-3 mb-4">
                  <BarChart2 className="text-indigo-400" size={24} />
                  <h3 className="text-xl font-bold text-white">Attendance Projections</h3>
               </div>
               <p className="text-sm text-slate-400 mb-4">Classes to attend to meet attendance goals.</p>
               <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-700 text-slate-400">
                     <tr><th className="py-2">Subject</th><th className="py-2 text-center">To Reach 75%</th><th className="py-2 text-center">To Reach 85%</th></tr>
                  </thead>
                  <tbody>
                    {subjects.map(s => (
                      <tr key={s.id} className="border-b border-slate-800">
                        <td className="py-2 capitalize font-medium text-slate-300">{s.name}</td>
                        <td className="py-2 text-center">{calculateProjection(s.present, s.conducted, 75)} classes</td>
                        <td className="py-2 text-center">{calculateProjection(s.present, s.conducted, 85)} classes</td>
                      </tr>
                    ))}
                    <tr className="font-bold text-white">
                       <td className="py-2">Overall</td>
                       <td className="py-2 text-center">{calculateProjection(summary.totalPresent, summary.totalConducted, 75)} classes</td>
                       <td className="py-2 text-center">{calculateProjection(summary.totalPresent, summary.totalConducted, 85)} classes</td>
                    </tr>
                  </tbody>
               </table>
            </div>

            {/* AI Advisor */}
            <div className="bg-slate-800/50 p-6 rounded-lg shadow-lg">
               <div className="flex items-center gap-3 mb-4">
                  <Lightbulb className="text-amber-400" size={24} />
                  <h3 className="text-xl font-bold text-white">AI Attendance Advisor</h3>
               </div>
               <p className="text-sm text-slate-400 mb-4">Get smart advice on how to improve your attendance based on your goals.</p>
               
               <div className="space-y-4">
                  <div>
                     <label className="text-sm font-medium text-slate-400 mb-2 block">Target Attendance</label>
                     <div className="flex gap-2">
                        {[75, 85].map(p => (
                           <button key={p} onClick={() => setTargetAdvicePercentage(p)} className={`px-4 py-1.5 text-sm rounded-full transition-all ${targetAdvicePercentage === p ? 'bg-indigo-600 text-white font-semibold' : 'bg-slate-700 hover:bg-slate-600'}`}>{p}%</button>
                        ))}
                     </div>
                  </div>
                  <div>
                      <label htmlFor="commitments" className="text-sm font-medium text-slate-400 mb-2 block">Future Commitments (Optional)</label>
                      <input id="commitments" type="text" value={futureCommitments} onChange={(e) => setFutureCommitments(e.target.value)} placeholder="e.g., Doctor's appointment" className="w-full bg-slate-700/50 p-2 rounded-md text-sm border border-slate-600"/>
                  </div>
                  <button onClick={handleGetAdvice} className="w-full bg-white text-slate-900 font-bold py-2 rounded-lg hover:bg-slate-200 transition-all">Get Advice</button>
                  {advice && <div className="text-sm bg-slate-700/50 p-3 rounded-md whitespace-pre-wrap">{advice}</div>}
               </div>
            </div>
          </aside>
        </main>

        {/* Add Subject Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">Add New Subject</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><X/></button>
              </div>
              <form onSubmit={handleAddSubject}>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="subName" className="text-sm font-medium text-slate-400 mb-2 block">Subject Name</label>
                    <input id="subName" type="text" value={newSubjectName} onChange={(e) => setNewSubjectName(e.target.value)} placeholder="e.g., Quantum Physics" className="w-full bg-slate-700 p-2 rounded-md border border-slate-600" required />
                  </div>
                  <div>
                    <label htmlFor="subType" className="text-sm font-medium text-slate-400 mb-2 block">Subject Type</label>
                    <input id="subType" type="text" value={newSubjectType} onChange={(e) => setNewSubjectType(e.target.value)} placeholder="e.g., Lecture, Lab" className="w-full bg-slate-700 p-2 rounded-md border border-slate-600" required />
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                   <button type="submit" className="bg-indigo-600 text-white font-semibold px-5 py-2 rounded-lg hover:bg-indigo-700 transition-all">Add Subject</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
