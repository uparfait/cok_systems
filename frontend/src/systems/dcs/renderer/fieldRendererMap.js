import TextField from "../fields/TextField.jsx";
import NumberField from "../fields/NumberField.jsx";
import EmailField from "../fields/EmailField.jsx";
import UrlField from "../fields/UrlField.jsx";
import PhoneField from "../fields/PhoneField.jsx";
import SingleSelectField from "../fields/SingleSelectField.jsx";
import MultiSelectField from "../fields/MultiSelectField.jsx";
import LikertScaleField from "../fields/LikertScaleField.jsx";
import RankingField from "../fields/RankingField.jsx";
import DateField from "../fields/DateField.jsx";
import TimeField from "../fields/TimeField.jsx";
import DateTimeField from "../fields/DateTimeField.jsx";
import DurationField from "../fields/DurationField.jsx";
import ImageField from "../fields/ImageField.jsx";
import VideoField from "../fields/VideoField.jsx";
import AudioField from "../fields/AudioField.jsx";
import FileUploadField from "../fields/FileUploadField.jsx";
import SignatureField from "../fields/SignatureField.jsx";
import GroupField from "../fields/GroupField.jsx";
import SectionField from "../fields/SectionField.jsx";
import HiddenField from "../fields/HiddenField.jsx";
import CascadingSelectField from "../fields/CascadingSelectField.jsx";
import ParagraphBlock from "../fields/structural/ParagraphBlock.jsx";
import HeaderBlock from "../fields/structural/HeaderBlock.jsx";
import FileBlock from "../fields/structural/FileBlock.jsx";
import ImageBlock from "../fields/structural/ImageBlock.jsx";
import HorizontalLineBlock from "../fields/structural/HorizontalLineBlock.jsx";
import ShapeBlock from "../fields/structural/ShapeBlock.jsx";

/**
 * The single mapping from a field type id to the component that renders
 * it. Adding a new field type only ever means adding one entry here.
 */
export const DCS_FIELD_RENDERER_MAP = {
  text: TextField,
  number: NumberField,
  email: EmailField,
  url: UrlField,
  phone: PhoneField,
  single_select: SingleSelectField,
  multi_select: MultiSelectField,
  likert_scale: LikertScaleField,
  ranking: RankingField,
  date: DateField,
  time: TimeField,
  date_time: DateTimeField,
  duration: DurationField,
  image: ImageField,
  video: VideoField,
  audio: AudioField,
  file_upload: FileUploadField,
  signature: SignatureField,
  group: GroupField,
  section: SectionField,
  hidden: HiddenField,
  cascading_select: CascadingSelectField,
  paragraph: ParagraphBlock,
  header: HeaderBlock,
  file: FileBlock,
  image_block: ImageBlock,
  horizontal_line: HorizontalLineBlock,
  shape: ShapeBlock,
};
