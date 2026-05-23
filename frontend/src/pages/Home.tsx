import { Browser } from '@capacitor/browser';
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { cog, globe, refresh, settings } from 'ionicons/icons';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBackendUrl } from '../services/settings';
import '../styles.css';

const HEALTH_ENDPOINT = '/health';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [backendUrl, setBackendUrl] = useState('');
  const [status, setStatus] = useState<'ok' | 'offline' | 'error' | 'loading'>('loading');
  const [message, setMessage] = useState('Checking backend availability...');

  useEffect(() => {
    const url = getBackendUrl();
    setBackendUrl(url);
  }, []);

  useEffect(() => {
    if (!backendUrl) return;
    setStatus('loading');
    fetch(`${backendUrl}${HEALTH_ENDPOINT}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Backend responded with an error');
        }
        const data = await response.json();
        setStatus('ok');
        setMessage(`Backend is available: ${data.status || 'ok'}`);
      })
      .catch(() => {
        setStatus('offline');
        setMessage('Backend is unreachable. Open settings to configure the cloud endpoint.');
      });
  }, [backendUrl]);

  const statusColor = useMemo(() => {
    switch (status) {
      case 'ok':
        return 'var(--ion-color-success)';
      case 'loading':
        return 'var(--ion-color-warning)';
      case 'offline':
      case 'error':
      default:
        return 'var(--ion-color-danger)';
    }
  }, [status]);

  const openRemoteApp = async () => {
    if (!backendUrl) {
      navigate('/settings');
      return;
    }

    const url = backendUrl;
    await Browser.open({ url });
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Dashboard</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => navigate('/settings')}>
              <IonIcon icon={settings} slot="icon-only" />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="page-content">
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Cloud-enabled StirlingPDF</IonCardTitle>
            <IonCardSubtitle>Works on mobile, web, and PWA</IonCardSubtitle>
          </IonCardHeader>
          <IonCardContent>
            <p>
              Open the hosted StirlingPDF service from your phone or browser. Configure the API endpoint, then tap "Open remote app".
            </p>
            <p>
              Current backend URL: <strong>{backendUrl || 'Not configured'}</strong>
            </p>
          </IonCardContent>
        </IonCard>

        <IonList>
          <IonItem lines="full">
            <IonLabel>
              <h2>Backend status</h2>
              <p>{message}</p>
            </IonLabel>
            <div className="status-badge" style={{ background: statusColor }}>
              {status === 'loading' ? <IonSpinner /> : status.toUpperCase()}
            </div>
          </IonItem>
        </IonList>

        <div className="button-row">
          <IonButton expand="block" onClick={openRemoteApp} color="primary">
            <IonIcon icon={globe} slot="start" />
            Open remote app
          </IonButton>
          <IonButton expand="block" fill="outline" onClick={() => window.location.reload()}>
            <IonIcon icon={refresh} slot="start" />
            Refresh status
          </IonButton>
        </div>

        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Next steps</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonList>
              <IonItem>
                <IonIcon icon={cog} slot="start" />
                <IonLabel>Set a hosted backend URL in Settings.</IonLabel>
              </IonItem>
              <IonItem>
                <IonIcon icon={globe} slot="start" />
                <IonLabel>Use the same app as a PWA or install from the Play Store.</IonLabel>
              </IonItem>
            </IonList>
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
};

export default Home;
