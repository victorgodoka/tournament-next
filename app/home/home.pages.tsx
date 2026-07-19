import type { CSSProperties } from 'react'
import Link from 'next/link'
import IconComponent from '../../components/icon/icon.component'
import { HOME_FEATURES, HOME_TOOLS, HOME_COMMUNITY } from './home.const'
import HomeHeroActions from './home-hero-actions.component'
import './home.styles.css'
import { BackdropComponent } from '@components'

const HomePage = () => {
  return (
    <div className="home">
      <BackdropComponent />

      <section className="home__hero omega-container" aria-labelledby="home-title">
        <span className="home__eyebrow omega-badge omega-badge--secondary">
          Duelists Unite
        </span>

        <h1 id="home-title" className="home__title">
          YGO Omega Duelists Unite
        </h1>

        <p className="home__lead">
          The competitive hub for tournaments, player rankings, and powerful tools
          to improve your game.
        </p>

        <HomeHeroActions />
      </section>

      <section className="home__section omega-container" aria-labelledby="home-features-title">
        <div className="home__section-header">
          <span className="home__section-eyebrow">Platform</span>
          <h2 id="home-features-title" className="home__section-title">
            Site Features
          </h2>
          <p className="home__section-lead">
            Everything you need to compete, analyze, and build — in one place.
          </p>
        </div>

        <ul className="home__feature-grid">
          {HOME_FEATURES.map((feature, index) => (
            <li
              key={feature.id}
              className="home__feature-item"
              style={{ '--home-stagger': `${index * 70}ms` } as CSSProperties}
            >
              <Link href={feature.to} className="home__feature-card">
                <span className="home__feature-icon-wrap" aria-hidden="true">
                  <IconComponent className="home__feature-icon" icon={feature.icon} />
                </span>
                <span className="home__feature-body">
                  <span className="home__feature-title">{feature.title}</span>
                  <span className="home__feature-description">{feature.description}</span>
                </span>
                <IconComponent
                  className="home__feature-arrow"
                  icon="mdi:arrow-right"
                />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="home__section omega-container" aria-labelledby="home-links-title">
        <div className="home__section-header">
          <span className="home__section-eyebrow">Explore</span>
          <h2 id="home-links-title" className="home__section-title">
            Tools &amp; Community
          </h2>
        </div>

        <div className="home__links-grid">
          <div className="home__link-panel">
            <h3 className="home__link-panel-title">Tools</h3>
            <ul className="home__tool-list">
              {HOME_TOOLS.map((tool) => (
                <li key={tool.to} className="home__tool-item">
                  <Link href={tool.to} className="home__tool-link">
                    <IconComponent className="home__tool-icon" icon={tool.icon} />
                    <span>{tool.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="home__link-panel">
            <h3 className="home__link-panel-title">Community</h3>
            <ul className="home__community-list">
              {HOME_COMMUNITY.map((link) => (
                <li key={link.href} className="home__community-item">
                  <a
                    href={link.href}
                    className="home__community-link"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="home__community-icon-wrap" aria-hidden="true">
                      <IconComponent className="home__community-icon" icon={link.icon} />
                    </span>
                    <span className="home__community-body">
                      <span className="home__community-label">{link.label}</span>
                      <span className="home__community-description">
                        {link.description}
                      </span>
                    </span>
                    <IconComponent
                      className="home__community-external"
                      icon="mdi:open-in-new"
                    />
                    <span className="visually-hidden"> (opens in new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}

export default HomePage
