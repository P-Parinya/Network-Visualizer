import React from 'react'
import Card from 'react-bootstrap/Card'
import 'bootstrap/dist/css/bootstrap.min.css'
import Accordion from 'react-bootstrap/Accordion'

class CollapsibleButton extends React.Component {
  render () {
    return (<Accordion id={this.props.id} className={this.props.className} style={this.props.style}>
      <Accordion.Toggle as={Card.Header} style={{ color: 'white', background: 'transparent', border: 'transparent', outline: 'none' }} eventKey={this.props.name}>
        {this.props.name}
      </Accordion.Toggle>
      <Accordion.Collapse as={Card.Body} eventKey={this.props.name} style={{ backgroundColor: '#213758', padding: '1%' }}>
        <div className="collapseContent">{this.props.children}</div>
      </Accordion.Collapse>
    </Accordion>)
  }
}

export default CollapsibleButton
