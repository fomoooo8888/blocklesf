# Blocage par liste (Instagram, TikTok, X)

**Une extension web pour Google Chrome qui bloque en une fois, sur tes comptes Instagram, TikTok et X (ex-Twitter), une liste de comptes de la droite et de l’extrême droite, à l’approche de 2027, selon la « méthode brésilienne ».**

Tu n’as pas besoin de savoir programmer, ni d’avoir un compte sur les trois réseaux. Ce guide explique tout pas à pas.

---

## Le principe : la méthode brésilienne

> Un mouvement inspiré du Brésil invite à bloquer les comptes des responsables politiques, des représentants, des médias ou encore des simples militants d’extrême droite sur les réseaux sociaux pour limiter leur portée ! 📲
>
> 👉 Au Brésil, le mot d’ordre « Senta o dedo no block » (Bloque-les en masse) a popularisé une stratégie d’invisibilisation des comptes d’extrême droite afin de limiter leur mise en avant par les algorithmes.
>
> Les internautes à l’origine de ce mouvement préconisent de ne plus commenter (même pour critiquer), de ne plus partager leurs propos et de bloquer ces comptes.

Bloquer des dizaines de comptes à la main, sur trois réseaux, prend des heures. Cette extension le fait à ta place, un compte après l’autre, depuis **tes** comptes.

**Important :** la liste Instagram fournie est celle choisie par l’auteur de l’extension. Les listes TikTok et X sont vides au départ : c’est à toi (ou à la personne qui t’a donné l’extension) de les remplir. Tu peux tout modifier librement avant de lancer quoi que ce soit.

---

## Crédits

Cette extension est une **réécriture de [AutoBlockout](https://github.com/mfrashad/AutoBlockout)**, créée par **[mfrashad](https://github.com/mfrashad)** et publiée sous licence MIT. AutoBlockout gérait le blocage sur TikTok et Instagram : son principe et son architecture ont servi de base à ce projet, étendu ici à X et regroupé en une seule extension. Un immense merci à son auteur. Pour la v1.1, deux autres projets ont inspiré les correctifs : [mass-block-twitter](https://github.com/rxliuli/mass-block-twitter) de rxliuli (méthode API pour X, GPL-3.0) et [tiktok-autoblocker](https://github.com/jimididit/tiktok-autoblocker) de jimididit (déclenchement des gestionnaires React sur TikTok). Leur code a servi de référence, pas de copie.

AutoBlockout avait été développé pour le mouvement **#Blockout2024**, qui appelait à bloquer en masse des célébrités et des entreprises accusées de complicité dans la guerre à Gaza. Son auteur y crédite lui-même [FactsFromCats](https://github.com/FactsFromCats) pour une partie du code de blocage.

 **Nouveau (v1.1)** : sur X, l'extension bloque désormais via l'API interne du site (comme l'outil mass-block-twitter de rxliuli), au lieu de cliquer les boutons — c'est beaucoup plus fiable et ça évite les blocages après quelques comptes ; si l'API échoue, elle revient au clic. Sur TikTok, les clics déclenchent maintenant les vrais gestionnaires de l'interface (technique de l'outil tiktok-autoblocker de jimididit), ce qui corrige l'erreur « confirmation non détectée ».

Ce qui a changé dans cette version : trois réseaux dans une seule extension, une liste par réseau, un réseau où tu n’es pas connecté est simplement ignoré, un seul compte traité à la fois avec une pause aléatoire, détection des boutons en français et en anglais, vérification que chaque compte est bien bloqué, arrêt automatique en cas de problème, et des permissions réduites à `instagram.com`, `tiktok.com` et `x.com`.

---

## Ce qu’il te faut (prérequis)

- **Un ordinateur** (Windows, Mac ou Linux). Cela ne fonctionne **pas** sur téléphone ni sur tablette.
- **Google Chrome** installé. ([Télécharger Chrome](https://www.google.com/chrome/)) Edge et Brave utilisent la même technologie et devraient fonctionner, mais ce n’est pas testé.
- **Au moins un compte** sur Instagram, TikTok ou X, **connecté dans Chrome** (tu te connectes toi-même sur le site, comme d’habitude). L’extension ne te demande **jamais** ton mot de passe.
- **Les réseaux en français ou en anglais.** L’extension reconnaît les boutons par leur texte (« Bloquer », « Block »…). Avec une autre langue, elle s’arrêtera avec un message d’erreur.
- **Du temps** : compte environ 30 secondes à une minute par compte, mais les réseaux sont traités à tour de rôle, donc c’est plus rapide qu’un réseau après l’autre. Tu n’as pas à rester devant l’écran, mais l’ordinateur doit rester allumé et connecté à Internet.
- **Un peu de disponibilité** : un réseau peut demander de résoudre une vérification (puzzle, « prouve que tu es humain ») ou afficher une limite en cours de route. Dans ce cas, l’extension arrête **ce réseau** et te le dit, les autres continuent.

### Et si je n’ai pas de compte sur un des réseaux ?
Aucun problème. Deux façons de faire, au choix :
- **Décoche le réseau** dans la page de l’extension (case à côté de son nom) : il sera ignoré.
- **Ou laisse-le coché** : si tu n’es pas connecté à ce réseau, l’extension le détecte au premier compte, **l’ignore** avec un message, et continue avec les autres réseaux.

---

## Installation pas à pas

L’extension n’est pas dans la boutique Chrome : on l’installe à la main. C’est simple et ça prend 3 minutes.

### Étape 1 : récupérer et ouvrir le dossier
1. Télécharge le fichier `.zip` de l’extension et enregistre-le, par exemple dans « Téléchargements ».
2. **Extrais-le** :
   - **Windows :** clic droit sur le fichier, puis « Extraire tout… », puis « Extraire ».
   - **Mac :** double-clique sur le fichier.
3. Tu obtiens un **dossier**. Garde-le à un endroit stable (par exemple « Documents ») : ne le supprime pas après l’installation, Chrome en a besoin.

### Étape 2 : l’ajouter à Chrome
1. Ouvre **Google Chrome**.
2. Dans la barre d’adresse tout en haut, tape `chrome://extensions` puis appuie sur **Entrée**.
3. En haut à droite de la page, **active** le bouton **« Mode développeur »**.
4. Clique sur **« Charger l’extension non empaquetée »** (en haut à gauche).
5. Choisis le dossier extrait à l’étape 1, **celui qui contient directement les fichiers** (dont `manifest.json`), pas un dossier parent. Valide.
6. L’extension apparaît dans la liste : « Blocage par liste (Instagram, TikTok, X) ».

### Étape 3 : la garder sous la main
Clique sur l’icône **puzzle** 🧩 en haut à droite de Chrome, puis sur l’**épingle** à côté du nom de l’extension. Son icône reste ainsi visible dans la barre.

> **Astuce :** à chaque démarrage, Chrome peut afficher un message à propos des « extensions en mode développeur ». Choisis l’option qui **conserve** l’extension (souvent « Annuler »). Le libellé peut varier selon la version.

---

## Utilisation

1. **Connecte-toi** dans Chrome aux réseaux où tu as un compte (instagram.com, tiktok.com, x.com).
2. Clique sur l’icône de l’extension. Une page s’ouvre dans un nouvel onglet : un bloc par réseau, avec sa case à cocher, son compteur et sa liste.
3. **Coche** les réseaux que tu veux traiter, **décoche** les autres.
4. Remplis les listes qui sont vides (voir « Remplir les listes » ci-dessous).
5. **Conseil :** fais d’abord un essai avec 2 ou 3 comptes pour vérifier que tout fonctionne chez toi.
6. Clique sur **« Lancer le blocage »** et confirme.
7. Une **fenêtre** s’ouvre : c’est normal, c’est elle qui travaille. Pendant l’exécution :
   - **ne ferme pas** la page de l’extension ni cette fenêtre ;
   - **ne minimise pas** cette fenêtre (tu peux la placer derrière d’autres fenêtres) ;
   - **ne mets pas l’ordinateur en veille.**
8. Chaque compte reçoit un statut : **Bloqué**, **Déjà bloqué**, **Introuvable** (nom changé, supprimé ou suspendu) ou **Échec**.
9. À la fin, la page affiche **« Terminé »** et la fenêtre se ferme toute seule. Si un réseau a été ignoré ou arrêté, la page te dit lequel et pourquoi.

Tu peux cliquer sur **« Arrêter après ce compte »** à tout moment. Si tu relances plus tard, seuls les comptes pas encore traités sont repris.

### Remplir les listes

Il y a deux façons :

**1. Réseau par réseau.** Dans le bloc d’un réseau, ouvre « Modifier la liste », écris **un compte par ligne** (avec ou sans @), puis « Enregistrer la liste ». Tu peux aussi coller des liens de profil.

**2. Ajout rapide, tous réseaux d’un coup.** Ouvre « Ajout rapide » et colle des lignes de ce type :

```
instagram:nom_du_compte
tiktok:nom_du_compte
x:nom_du_compte
https://x.com/autre_compte
```

Chaque ligne est rangée dans le bon réseau. Un lien de profil (Instagram, TikTok, X ou twitter.com) est reconnu tout seul ; un nom seul doit avoir le réseau devant (`instagram:`, `tiktok:` ou `x:`). C’est exactement le format de la liste copiée depuis la page **« Identifier les comptes »**.

### Retrouver les identifiants à partir de noms

Tu connais le nom d’une personne mais pas son identifiant sur chaque réseau ? Ouvre le fichier **`identifier-comptes-multi.html`** dans Chrome (double-clic). Pour chaque nom et chaque réseau, la page propose un lien de recherche : tu repères le bon profil, tu colles son @ ou son lien, puis tu copies la liste finale et tu la colles dans « Ajout rapide ». Elle peut aussi pré-remplir des suggestions depuis Wikidata (à valider une par une). **Un même nom peut désigner des personnes différentes selon le réseau : vérifie toujours la photo et la bio avant de valider.**

### Régler la vitesse
Dans « Réglages », tu choisis la pause aléatoire entre deux blocages **d’un même réseau** (20 à 45 secondes par défaut, 15 au minimum). **Plus c’est lent, moins c’est risqué** pour tes comptes.

---

## Si quelque chose ne va pas

| Ce que tu vois | Que faire |
|---|---|
| « Ignoré : tu n’es pas connecté à… » sous un réseau | Connecte-toi à ce réseau dans la fenêtre qui s’est ouverte (ou dans Chrome), puis relance. Si tu n’as pas de compte sur ce réseau, décoche-le. |
| Message de **limite** ou de **vérification** sur un réseau | Si le réseau te demande de prouver que tu es humain, fais-le dans la fenêtre puis relance. S’il affiche une limite, **attends plusieurs heures** (idéalement jusqu’au lendemain) avant de relancer ce réseau. N’insiste pas. |
| **Échec** sur un compte, puis arrêt de ce réseau | Ouvre « Journal » en bas de la page pour lire la raison. Il est possible que le réseau ait changé son interface. Réessaie une fois ; si cela se reproduit, signale-le à l’auteur en copiant la ligne du journal. |
| La fenêtre s’est fermée | Relance : l’extension reprend là où elle s’était arrêtée. |
| **Introuvable** | Le compte a changé de nom, a été supprimé ou suspendu, ou n’existe pas. Vérifie l’orthographe. |

**Débloquer un compte** (ou annuler un blocage fait par erreur) : ouvre son profil sur le réseau et utilise le bouton « Débloquer » (ou « Bloqué » sur X), puis confirme.
**Désinstaller l’extension** : `chrome://extensions`, puis « Supprimer ».

---

## À savoir avant de l’utiliser

- **Sur X, la méthode API est plus efficace mais plus exposée.** Elle réutilise le jeton de ta session (jamais ton mot de passe, rien n'est envoyé ailleurs), mais c'est exactement le type d'automatisation que X surveille. Garde des pauses et des listes raisonnables.
- **Ce n’est pas prévu par les réseaux.** Les règles d’Instagram, de TikTok et de X n’autorisent pas l’automatisation d’actions sur leur site. Avec peu de comptes bien espacés, le risque est limité, mais **il n’est pas nul** : un réseau peut demander des vérifications, limiter temporairement certaines actions de ton compte, voire le suspendre. Tu l’utilises **à tes risques**.
- **Aucun mot de passe n’est demandé ni envoyé.** L’extension agit dans tes sessions déjà ouvertes.
- **Tes données restent sur ton ordinateur.** Les listes et les statuts sont enregistrés localement dans Chrome. Rien n’est envoyé à un serveur. (La page « Identifier les comptes » n’interroge que Wikidata, et seulement si tu cliques sur « Chercher automatiquement ».)
- **Permissions minimales :** l’extension n’a accès qu’aux sites `instagram.com`, `tiktok.com` et `x.com`.
- **Aucune garantie.** Ces sites modifient régulièrement leur interface : l’extension peut cesser de fonctionner, réseau par réseau, du jour au lendemain. **Cette version n’a pas pu être testée sur les vrais sites** : fais d’abord un essai avec 2 ou 3 comptes.

---

## Pour la personne qui maintient les listes (un peu technique)

Les listes par défaut sont écrites en texte brut en haut du fichier `app.js`, dans `DEFAULT_USERS` (une liste par réseau, entre deux accents graves), un compte par ligne, avec ou sans @.

Pour les mettre à jour : modifie les listes, puis augmente le nombre `LIST_VERSION` (1 devient 2). Les nouveaux comptes seront ajoutés chez les personnes qui ont déjà l’extension, sans toucher à leurs statuts ni à leurs ajouts personnels. Il faut ensuite leur redonner le dossier mis à jour et leur demander de cliquer sur « Recharger » (flèche circulaire) sur `chrome://extensions`.

Les textes reconnus (en français et en anglais) sont en haut de chaque fonction `pageTaskInstagram`, `pageTaskTikTok` et `pageTaskX` : ajoute-y d’autres langues si besoin.

---

## Licence

Licence MIT, voir `LICENSE.txt` (Copyright (c) 2024 @FactsFromCats, Copyright (c) 2024 AutoBlockout). Le code est fourni tel quel, sans garantie.
