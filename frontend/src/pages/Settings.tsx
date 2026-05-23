import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useEffect, useState } from 'react';
import { getBackendUrl, saveBackendUrl } from '../services/settings';
import '../styles.css';

const Settings: React.FC = () => {
  const [backendUrl, setBackendUrl] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setBackendUrl(getBackendUrl());
  }, []);

  const handleSave = () => {
    saveBackendUrl(backendUrl.trim() || 'http://localhost:4000');
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Settings</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="page-content">
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Backend configuration</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <p>Set the public or local backend endpoint used by the mobile/web app.</p>
            <IonItem>
              <IonLabel position="stacked">Backend URL</IonLabel>
              <IonInput
                value={backendUrl}
                placeholder="https://api.example.com"
                onIonChange={(event) => setBackendUrl(event.detail.value ?? '')}
              />
            </IonItem>
            <div className="button-row">
              <IonButton expand="block" onClick={handleSave} color="secondary">
                Save settings
              </IonButton>
            </div>
            {saved && <p className="save-notice">Settings saved successfully.</p>}
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
};

export default Settings;
