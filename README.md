<div align="center">

# VolleyManager

### A modern tournament management system built with Flask & Tailwind CSS

<i>Works perfectly on mobile and desktop</i>

<br>

<img src="https://img.shields.io/badge/Python-3.14-blue?style=for-the-badge&logo=python" height="25">
<img src="https://img.shields.io/badge/Flask-3.1.2-lightgrey?style=for-the-badge&logo=flask" height="25">
<img src="https://img.shields.io/badge/Tailwind_CSS-4.1.17-38B2AC?style=for-the-badge&logo=tailwind-css" height="25">

</div>

<br>

## Dashboard & Controls

The central hub for managing tournaments.

<img src="./docs/dashboard-admin.png" width="100%" alt="Dashboard Admin">

### Appearance Modes

Seamless support for both light and dark environments.

<div align="center">
  <img src="./docs/dashboard-dark.png" width="48%" alt="Dark Mode">
  <img src="./docs/dashboard-light.png" width="48%" alt="Light Mode">
</div>

---

## Tournament Management

### Setup & Creation

<div align="center">
<img src="./docs/settings.png" height="400px" alt="Settings">
</div>

### Bracket Visualization

Dynamic bracket generation handling various tournament sizes.

<div align="center">
  <img src="./docs/bracket-dark.png" width="48%" alt="Bracket Dark">
  <img src="./docs/bracket-light.png" width="48%" alt="Bracket Light">
</div>

### Bracket Variants

**Single Elimination & Live Scoring**

<div align="center">
  <img src="./docs/bracket-single.png" width="48%" alt="Single Elim">
  <img src="./docs/bracket-scoring.png" width="48%" alt="Scoring">
</div>

---

## Scheduling & Results

Automated scheduling views with real-time score updates.

<img src="./docs/schedule.png" width="100%" alt="Schedule">

---

## Role-Based Scoring

Secure scoring interfaces for Referees and Administrators.

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="./docs/score-ref.png" width="100%" alt="Referee View">
    </td>
    <td width="50%" valign="top">
      <img src="./docs/score-admin.png" width="100%" alt="Admin View">
    </td>
  </tr>

  <tr>
    <td valign="top">
      <h3> Referee View</h3>
      <p>
        <b>Restricted Access</b><br>
        Referees must enter a tournament code to submit scores.
        <b>Note</b>: Clear only appears if scores are already submitted.
      </p>
    </td>
    <td valign="top">
      <h3> Admin View</h3>
      <p>
        <b>Full Access</b><br>
        Admins are free to submit, edit, or override scores at any time without codes.
      </p>
    </td>
  </tr>
</table>

## Deploy

Clone the repo and run the docker-compose or create your own. Create a .env file with your custom values there is an example.env available.
