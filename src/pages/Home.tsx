import React, { useState, useEffect } from 'react';
import {
    IonContent, IonHeader, IonPage, IonTitle, IonToolbar,
    IonList, IonItem, IonLabel, IonInput, IonButton,
    IonText, IonSelect, IonSelectOption, IonProgressBar, IonButtons,
    IonLoading, IonToast
} from '@ionic/react';
import './Home.css';

// Interfață pentru elementele din meniu conform serverului
interface MenuItem {
    code: number;
    name: string;
    price: number;
    quantity?: number;
    status?: 'idle' | 'loading' | 'success' | 'error';
}

const Home: React.FC = () => {
    // Cerința 1: Masa salvată local
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [table, setTable] = useState<string | null>(localStorage.getItem('table'));
    const [inputTable, setInputTable] = useState('');
    const [menu, setMenu] = useState<MenuItem[]>([]);
    const [filter, setFilter] = useState<'all' | 'ordered'>('all');
    const [editingCode, setEditingCode] = useState<number | null>(null);
    const [isLoadingMenu, setIsLoadingMenu] = useState(false);

    // Cerința 2: Gestionare Meniu (WS + Local Storage)
    useEffect(() => {
        if (!table) return;

        const savedMenu = localStorage.getItem('menu');
        if (savedMenu) {
            setMenu(JSON.parse(savedMenu));
        } else {
            setIsLoadingMenu(true);
            const ws = new WebSocket('ws://localhost:3000');

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                const initializedMenu = data.map((item: any) => ({ ...item, status: 'idle' }));
                setMenu(initializedMenu);
                localStorage.setItem('menu', JSON.stringify(initializedMenu));
                setIsLoadingMenu(false);
                ws.close();
            };

            ws.onerror = () => {
                setIsLoadingMenu(true); // Oprim loading-ul dacă e eroare
                setErrorMsg("Eroare IO: Nu s-a putut contacta serverul pentru meniu.");
                ws.close();
            };
        }
    }, [table]);

    const handleSetTable = () => {
        if (inputTable.trim()) {
            localStorage.setItem('table', inputTable);
            setTable(inputTable);
        }
    };

    const updateItemStatus = (code: number, status: MenuItem['status']) => {
        setMenu(prev => prev.map(it => it.code === code ? { ...it, status } : it));
    };

    const updateQuantity = (code: number, qty: number) => {
        setMenu(prev => {
            const newMenu = prev.map(it => it.code === code ? { ...it, quantity: qty, status: 'idle' } : it);
            localStorage.setItem('menu', JSON.stringify(newMenu));
            return newMenu;
        });
        setEditingCode(null);
    };

    // Cerința 7 & 8: Trimitere comenzi în paralel
    const handleSubmit = async () => {
        // Trimitem doar produsele cu cantitate care nu au fost deja trimise cu succes
        const itemsToSubmit = menu.filter(item =>
            item.quantity && item.quantity > 0 && item.status !== 'success'
        );

        const promises = itemsToSubmit.map(async (item) => {
            // Cerința 9: Progress indicator per element
            updateItemStatus(item.code, 'loading');

            try {
                const response = await fetch('http://localhost:3000/item', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        code: item.code,
                        quantity: item.quantity,
                        table: Number(table)
                    })
                });

                if (response.ok) {
                    updateItemStatus(item.code, 'success');
                } else {
                    // Cerința 8: Font roșu la eroare
                    updateItemStatus(item.code, 'error');
                    setErrorMsg(`Eroare server pentru produsul ${item.name}`);
                }
            } catch (e) {
                updateItemStatus(item.code, 'error');
                setErrorMsg("Eroare de rețea: Verifică conexiunea la server.");
            }
        });

        await Promise.all(promises);
    };

    if (!table) {
        return (
            <IonPage>
                <IonHeader>
                    <IonToolbar><IonTitle>Setare Masă</IonTitle></IonToolbar>
                </IonHeader>
                <IonContent className="ion-padding">
                    <IonItem>
                        <IonLabel position="floating">Număr Masă</IonLabel>
                        <IonInput
                            value={inputTable}
                            onIonInput={e => setInputTable(e.detail.value!)}
                            type="number"
                        />
                    </IonItem>
                    <IonButton expand="block" onClick={handleSetTable}>Set Table</IonButton>
                </IonContent>
            </IonPage>
        );
    }

    // Cerința 6: Filtrare
    const displayedMenu = menu.filter(item =>
        filter === 'all' || (item.quantity && item.quantity > 0)
    );

    return (
        <IonPage>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>Masa {table}</IonTitle>
                    <IonButtons slot="end">
                        <IonSelect value={filter} onIonChange={e => setFilter(e.detail.value)}>
                            <IonSelectOption value="all">Toate</IonSelectOption>
                            <IonSelectOption value="ordered">Comandate</IonSelectOption>
                        </IonSelect>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>

            <IonContent>
                <IonLoading isOpen={isLoadingMenu} message={'Se încarcă meniul...'} />

                <IonList>
                    {displayedMenu.map(item => (
                        <IonItem key={item.code}>
                            <IonLabel onClick={() => setEditingCode(item.code)}>
                                <h2>{item.name} - {item.price} lei</h2>
                                {/* Cerința 4: Afișare preț total */}
                                {item.quantity && (
                                    <p>Total: {item.quantity * item.price} lei</p>
                                )}
                            </IonLabel>

                            {/* Cerința 5: Editare cantitate la click */}
                            {editingCode === item.code ? (
                                <IonInput
                                    type="number"
                                    autofocus
                                    onIonBlur={(e) => updateQuantity(item.code, Number(e.target.value))}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') updateQuantity(item.code, Number((e.target as any).value));
                                    }}
                                />
                            ) : (
                                <IonText color={item.status === 'error' ? 'danger' : 'primary'}>
                                    {item.quantity || 0} buc.
                                </IonText>
                            )}

                            {item.status === 'loading' && <IonProgressBar type="indeterminate" />}
                        </IonItem>
                    ))}
                </IonList>

                <IonButton expand="block" onClick={handleSubmit} className="ion-margin">
                    Submit
                </IonButton>

                <IonToast
                    isOpen={!!errorMsg}
                    message={errorMsg || ''}
                    duration={3000}
                    onDidDismiss={() => setErrorMsg(null)}
                    color="danger"
                    buttons={[{ text: 'Închide', role: 'cancel' }]}
                />
            </IonContent>
        </IonPage>
    );
};

export default Home;