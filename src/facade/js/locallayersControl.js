import namespace from 'mapea-util/decorator';
import LocalLayersImplControl from 'impl/locallayersControl';
import * as shp from 'shpjs';

@namespace("M.control")
export class LocalLayersControl extends M.Control {

  /**
   * @classdesc
   * Main constructor of the class. Creates a PluginControl
   * control
   *
   * @constructor
   * @extends {M.Control}
   * @api stable
   */
  constructor() {
    // 1. checks if the implementation can create PluginControl
    if (M.utils.isUndefined(M.impl.control.LocalLayersControl)) {
      M.exception('La implementación usada no puede crear controles LocalLayersControl');
    }
    // 2. implementation of this control
    let impl = new M.impl.control.LocalLayersControl();
    super(impl, "LocalLayers");

    this.centerview_ = true;
    this.file_ = null;
    this.inputName_ = null;
    this.loadBtn_ = null;
    this.inputCenter_ = null;
    this.inputStyle_ = null;
    this.extractstyleContainer_ = null;
    this.accept_ = ".kml, .zip, .gpx, .geojson";

  }

  /**
   *
   *
   * @param {any} html
   * @memberof LocalLayersControl
   */
  addEvents(html) {
    let inputFile = html.querySelector('.form div.file > input');
    this.loadBtn_ = html.querySelector('.button > button.load');
    this.inputName_ = html.querySelector('.form div.name > input');
    this.inputCenter_ = html.querySelector('.form div.centerview > input');
    this.inputStyle_ = html.querySelector('.form div.extractstyle > input');
    this.extractstyleContainer_ = html.querySelector('.form div.extractstyle');

    inputFile.addEventListener('change', (evt) => this.changeFile(evt, inputFile.files[0]));
    this.loadBtn_.addEventListener('click', (evt) => this.loadLayer());
    this.inputName_.addEventListener('input', (evt) => this.changeName(evt));
  }

  /**
   * This function creates the view
   *
   * @public
   * @function
   * @param {M.Map} map to add the control
   * @api stable
   */
  createView(map) {
    return new Promise((success, fail) => {
      M.template.compile('locallayers.html', { vars: { accept: this.accept_, centerview: this.centerview_ } }).then((html) => {
        //Establecer eventos
        this.addEvents(html);
        success(html);
      });
    });
  }

  /**
   *
   * Obtiene elemento del DOM escapando caracteres (no validos para busqueda por CSS)
   * @param {any} target
   * @param {any} selector
   * @returns
   * @memberof LocalLayersControl
   */
  getQuerySelectorScapeCSS(target, selector) {
    return target.querySelector(CSS.escape(selector));
  }

  /**
   *
   *
   * @param {any} file
   * @memberof LocalLayersControl
   */
  changeFile(evt, file) {
    evt = (evt || window.event);
    let itemTarget = evt.target;
    this.file_ = file;
    // Desactivo la escritura y vacio el nombre, además de desactivar el boton
    this.inputName_.value = '';
    this.inputName_.disabled = true;
    this.loadBtn_.disabled = true;
    if (!M.utils.isNullOrEmpty(file)) {
      if (file.size > 20971520) {
        M.dialog.info('El fichero seleccionado sobrepasa el máximo de 20 MB permitido');
        this.file_ = null;
      } else {
        // Si la extensión es kml habilito la opción de extraer estilos
        let fileExt = this.file_.name.slice((this.file_.name.lastIndexOf(".") - 1 >>> 0) + 2);
        if (fileExt === 'kml') {
          this.extractstyleContainer_.classList.remove("dnone");
        } else {
          this.extractstyleContainer_.classList.add("dnone");
        }
        // Elimino la extensión y la pongo como nombre de capa
        this.inputName_.value = file.name.replace(/\.[^/.]+$/, '');
        // Activo la escritura en el input y el boton de carga
        this.inputName_.disabled = false;
        this.loadBtn_.disabled = false;
      }
    }
  }

  /**
   *
   *
   * @param {any} evt
   * @memberof LocalLayersControl
   */
  changeName(evt) {
    evt = (evt || window.event);
    let itemTarget = evt.target;
    this.loadBtn_.disabled = (itemTarget.value.trim() == '') ? true : false;
  }

  /**
   *
   *
   * @memberof LocalLayersControl
   */
  loadLayer() {

    // Consigo la extensión del fichero
    let fileExt = this.file_.name.slice((this.file_.name.lastIndexOf(".") - 1 >>> 0) + 2);
    let fileReader = new FileReader();
    fileReader.addEventListener('load', (e) => {
      try {
        let features = [];
        if (fileExt === 'zip') {
          // Por si se trata de un conjunto de shapes, recojo el geojson en un array y junto las features
          let geojsonArray = [].concat(shp.parseZip(fileReader.result));
          for (let geojson of geojsonArray) {
            let localFeatures = this.getImpl().loadGeoJSONLayer(this.inputName_.value, geojson);
            if (localFeatures) {
              features = features.concat(localFeatures);
            }
          }
        } else if (fileExt === 'kml') {
          // Si se pudiese hacer por url sin usar el proxy que machaca el blob
          /* let url = URL.createObjectURL(new Blob([fileReader.result], {
            type: 'text/plain'
          }));
          features = this.getImpl().loadKMLLayer(this.inputName_.value, url); */
          features = this.getImpl().loadKMLLayer(this.inputName_.value, fileReader.result, this.inputStyle_.checked);
          if (features.length) {

          }
        } else if (fileExt === 'gpx') {
          features = this.getImpl().loadGPXLayer(this.inputName_.value, fileReader.result);
          if (features.length) {

          }
        } else if (fileExt === 'geojson') {
          features = this.getImpl().loadGeoJSONLayer(this.inputName_.value, fileReader.result);
        } else { // No debería entrar aquí nunca
          M.dialog.error('Error al cargar el fichero');
          return;
        }
        if (!features.length) {
          M.dialog.info('No se han detectado geometrías en este fichero');
        } else {
          if (this.inputCenter_.checked) {
            this.getImpl().centerFeatures(features);
          }
        }
      } catch (error) {
        console.log(error);
        M.dialog.error('Error al cargar el fichero. Compruebe que se trata del fichero correcto');
      }
    });
    if ((this.accept_.indexOf(".zip") > -1 && fileExt === 'zip')) {
      fileReader.readAsArrayBuffer(this.file_);
    } else if ((this.accept_.indexOf(".kml") > -1 && fileExt === 'kml') || (this.accept_.indexOf(".gpx") > -1 && fileExt === 'gpx')
      || (this.accept_.indexOf(".geojson") > -1 && fileExt === 'geojson')) {
      fileReader.readAsText(this.file_);
    }
    else {
      M.dialog.error('No se ha insertado una extensión de archivo permitida. Las permitidas son: ' + this.accept_);
    }
  }
}

